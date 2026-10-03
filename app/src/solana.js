// Talks to Solana: reads the sale, mints licenses, lists a wallet's licenses.
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { generateSigner, publicKey, some, transactionBuilder, unwrapOption } from '@metaplex-foundation/umi';
import { mplCore } from '@metaplex-foundation/mpl-core';
import {
  mplCandyMachine,
  fetchCandyMachine,
  safeFetchCandyGuard,
  mintV1,
  safeFetchMintCounterFromSeeds,
} from '@metaplex-foundation/mpl-core-candy-machine';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { CONFIG } from './config';

function makeUmi(wallet) {
  const umi = createUmi(CONFIG.rpcUrl).use(mplCore()).use(mplCandyMachine());
  if (wallet) umi.use(walletAdapterIdentity(wallet));
  return umi;
}

const opt = (o) => (o ? unwrapOption(o) : null);

/** Reads one Candy Machine and its guards. */
async function loadMachine(umi, address) {
  const cm = await fetchCandyMachine(umi, publicKey(address));
  const guard = await safeFetchCandyGuard(umi, cm.mintAuthority);
  const g = guard?.guards || {};
  const pay = opt(g.solPayment);
  const start = opt(g.startDate);
  const limit = opt(g.mintLimit);
  const total = Number(cm.data.itemsAvailable);
  const sold = Number(cm.itemsRedeemed);
  return {
    address,
    total,
    sold,
    remaining: Math.max(0, total - sold),
    priceSol: pay ? Number(pay.lamports.basisPoints) / 1e9 : CONFIG.defaults.priceSol,
    treasury: pay ? pay.destination.toString() : null,
    startsAt: start ? Number(start.date) * 1000 : null,
    limit: limit ? limit.limit : CONFIG.defaults.maxPerWallet,
    mintLimitId: limit ? limit.id : null,
    candyGuard: cm.mintAuthority.toString(),
    collection: cm.collectionMint.toString(),
  };
}

/**
 * Reads every sale machine. With five machines each one is a tier color (Seedling first);
 * with one it's the original single-color sale.
 */
export async function loadSale() {
  if (!CONFIG.candyMachines.length) return null;
  const umi = makeUmi();
  const machines = await Promise.all(CONFIG.candyMachines.map((a) => loadMachine(umi, a)));
  const first = machines[0];
  const starts = machines.map((m) => m.startsAt).filter(Boolean);
  return {
    machines,
    tiered: machines.length > 1,
    total: machines.reduce((s, m) => s + m.total, 0),
    sold: machines.reduce((s, m) => s + m.sold, 0),
    priceSol: first.priceSol,
    treasury: first.treasury,
    startsAt: starts.length ? Math.min(...starts) : null,
    maxPerWallet: machines.reduce((s, m) => s + m.limit, 0),
    collection: first.collection,
  };
}

/** How many licenses this wallet already bought from each machine (the on-chain counters the limits use). */
export async function getMintedCounts(owner, sale) {
  if (!owner || !sale?.machines) return [];
  const umi = makeUmi();
  return Promise.all(
    sale.machines.map(async (m) => {
      if (m.mintLimitId === null) return 0;
      const counter = await safeFetchMintCounterFromSeeds(umi, {
        id: m.mintLimitId,
        user: publicKey(owner),
        candyGuard: publicKey(m.candyGuard),
        candyMachine: publicKey(m.address),
      });
      return counter ? counter.count : 0;
    })
  );
}

/**
 * Which machine each of the wallet's next licenses comes from, in order.
 * Tiered sale: the next colors this wallet doesn't have yet (skipping sold-out ones).
 */
export function purchasePlan(sale, counts = []) {
  const plan = [];
  (sale?.machines || []).forEach((m, i) => {
    const room = Math.min(m.limit - (counts[i] || 0), m.remaining);
    for (let k = 0; k < room; k++) plan.push(i);
  });
  return plan;
}

/** Mints one license per entry in `plan` (machine indexes), one transaction each. */
export async function buyLicenses(wallet, sale, plan, onProgress) {
  const umi = makeUmi(wallet);
  const minted = [];
  for (let i = 0; i < plan.length; i++) {
    onProgress?.(i + 1, plan.length);
    const m = sale.machines[plan[i]];
    const asset = generateSigner(umi);
    const mintArgs = {};
    if (m.treasury) mintArgs.solPayment = some({ destination: publicKey(m.treasury) });
    if (m.mintLimitId !== null) mintArgs.mintLimit = some({ id: m.mintLimitId });
    const { signature } = await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 800_000 }))
      .add(
        mintV1(umi, {
          candyMachine: publicKey(m.address),
          asset,
          collection: publicKey(m.collection),
          mintArgs,
        })
      )
      .sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
    minted.push({ address: asset.publicKey.toString(), signature, machine: plan[i] });
  }
  return minted;
}

/** Lists the Grower Node licenses in a wallet (needs a Helius RPC URL for DAS). */
export async function getMyLicenses(owner, collection) {
  const res = await fetch(CONFIG.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'sprout-nodes',
      method: 'getAssetsByOwner',
      params: { ownerAddress: owner, page: 1, limit: 1000 },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Could not load licenses');
  return (json.result?.items || [])
    .filter((a) => a.grouping?.some((g) => g.group_key === 'collection' && g.group_value === collection))
    .map((a) => ({ address: a.id, name: a.content?.metadata?.name || 'Grower Node' }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** Turns wallet and program errors into a sentence a buyer can act on. */
export function friendlyError(err) {
  const msg = String(err?.message || err || '');
  if (/rejected|declined|cancel/i.test(msg)) return 'You cancelled the payment in your wallet. Nothing was charged.';
  if (/insufficient|0x1\b|Attempt to debit/i.test(msg)) return "Your wallet doesn't have enough SOL for this. Top it up and try again.";
  if (/MintNotLive|StartDate|not live/i.test(msg)) return "The sale hasn't opened yet. Check back when the countdown hits zero.";
  if (/MintLimit|maximum/i.test(msg)) return "You've reached the maximum licenses for one wallet.";
  if (/CandyMachineEmpty|NotEnoughTokens|sold out/i.test(msg)) return 'All licenses are sold out.';
  if (/blockhash|timed out|Timeout/i.test(msg)) return 'The network was slow and the payment timed out. Check My Nodes before trying again.';
  return 'Something went wrong with the payment. Check My Nodes to see if it went through, then try again.';
}
