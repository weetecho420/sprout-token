// Pay with Sprout: Solana Pay QR codes for a shop counter, plus payment checking.
// The shop types an amount in pesos (or NZD/USD), we convert it to tokens at the live price,
// show a Solana Pay QR with a one-time "reference" key, and watch the chain for a
// transaction that carries that reference and pays the shop enough.
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { CONFIG } from './config';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

/** What customers pay in: $SPROUT after launch, test SOL before. */
export function payToken() {
  if (CONFIG.sproutMint) {
    return { symbol: 'SPROUT', mint: CONFIG.sproutMint, decimals: CONFIG.sproutDecimals, test: false };
  }
  return { symbol: 'SOL', mint: null, decimals: 9, test: true };
}

export const CURRENCIES = {
  PHP: { sign: '₱', name: 'Philippine peso' },
  NZD: { sign: 'NZ$', name: 'New Zealand dollar' },
  USD: { sign: '$', name: 'US dollar' },
};

export function isWallet(address) {
  try {
    return PublicKey.isOnCurve(new PublicKey(address.trim()).toBytes());
  } catch {
    return false;
  }
}

// ---------- prices ----------
const cache = new Map();
async function cached(key, ms, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Token price in USD from DexScreener (no key needed). Uses the most liquid pair. */
export function tokenUsdPrice(mint) {
  return cached(`usd:${mint}`, 60_000, async () => {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
    if (!res.ok) throw new Error('price');
    const pairs = (await res.json()) || [];
    const best = pairs
      .filter((p) => p?.baseToken?.address === mint && Number(p.priceUsd) > 0)
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (!best) throw new Error('price');
    return Number(best.priceUsd);
  });
}

/** How many of `currency` one US dollar buys. */
export function usdRate(currency) {
  if (currency === 'USD') return Promise.resolve(1);
  return cached(`fx:${currency}`, 30 * 60_000, async () => {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const json = res.ok ? await res.json() : null;
    const rate = Number(json?.rates?.[currency]);
    if (!(rate > 0)) throw new Error('fx');
    return rate;
  });
}

/** Price of one token in the shop's currency. */
export async function tokenPrice(token, currency) {
  const [usd, fx] = await Promise.all([tokenUsdPrice(token.mint || SOL_MINT), usdRate(currency)]);
  return usd * fx;
}

/** Rounds a token amount up, so the shop never gets less than asked. Returns a plain string. */
export function tokenAmount(value, token) {
  const places = token.symbol === 'SOL' ? 6 : value >= 100 ? 0 : 2;
  const d = Math.min(places, token.decimals);
  const f = 10 ** d;
  const up = Math.ceil(value * f - 1e-9) / f;
  return up.toFixed(d).replace(/\.?0+$/, '') || '0';
}

// ---------- Solana Pay ----------
export function newReference() {
  return bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
}

/** A Solana Pay transfer request link (what the QR holds). */
export function payLink({ to, amount, token, reference, label, message }) {
  const q = new URLSearchParams();
  if (amount) q.set('amount', amount);
  if (token.mint) q.set('spl-token', token.mint);
  if (reference) q.set('reference', reference);
  if (label) q.set('label', label);
  if (message) q.set('message', message);
  const qs = q.toString().replace(/\+/g, '%20'); // spaces as %20, which every wallet reads
  return `solana:${to}${qs ? `?${qs}` : ''}`;
}

async function rpc(method, params) {
  const res = await fetch(CONFIG.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'rpc');
  return json.result;
}

/** How much `owner` received in this transaction, in token units. */
export function amountReceived(tx, owner, token) {
  const meta = tx?.meta;
  if (!meta || meta.err) return 0;
  if (!token.mint) {
    const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === 'string' ? k : k.pubkey));
    const i = keys.indexOf(owner);
    if (i < 0) return 0;
    return (meta.postBalances[i] - meta.preBalances[i]) / 1e9;
  }
  const sum = (list) =>
    (list || [])
      .filter((b) => b.owner === owner && b.mint === token.mint)
      .reduce((s, b) => s + Number(b.uiTokenAmount?.uiAmountString || 0), 0);
  return sum(meta.postTokenBalances) - sum(meta.preTokenBalances);
}

/**
 * Looks for a payment carrying `reference`. Returns null while nothing has arrived,
 * { ok: true, signature, received } when the shop got at least `amount`,
 * or { ok: false, ... } when a payment arrived but was short or failed.
 */
export async function findPayment({ reference, to, amount, token }) {
  const sigs = await rpc('getSignaturesForAddress', [reference, { limit: 5, commitment: 'confirmed' }]);
  const sig = sigs?.find((s) => !s.err) || sigs?.[0];
  if (!sig) return null;
  const tx = await rpc('getTransaction', [
    sig.signature,
    { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
  ]);
  if (!tx) return null; // seen but not readable yet
  const received = amountReceived(tx, to, token);
  // A hair of tolerance for float rounding in UI amounts
  return { ok: !sig.err && received + 1e-9 >= Number(amount), signature: sig.signature, received };
}

// ---------- shop settings (this device only) ----------
const SHOP_KEY = 'sprout-pay-shop';
const HISTORY_KEY = 'sprout-pay-history';

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: settings last for this visit only */
  }
}

export const loadShop = () => read(SHOP_KEY, null);
export const saveShop = (shop) => write(SHOP_KEY, shop);
export const loadHistory = () => read(HISTORY_KEY, []);
export function addHistory(entry) {
  const list = [entry, ...loadHistory()].slice(0, 30);
  write(HISTORY_KEY, list);
  return list;
}
