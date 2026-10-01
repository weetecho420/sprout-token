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
} from '@metaplex-foundation/mpl-core-candy-machine';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { CONFIG } from './config';

function makeUmi(wallet) {
  const umi = createUmi(CONFIG.rpcUrl).use(mplCore()).use(mplCandyMachine());
  if (wallet) umi.use(walletAdapterIdentity(wallet));
  return umi;
}

const opt = (o) => (o ? unwrapOption(o) : null);

/** Reads price, supply, sold count, start date and limits from the Candy Machine. */
export async function loadSale() {
  if (!CONFIG.candyMachine) return null;
  const umi = makeUmi();
  const cm = await fetchCandyMachine(umi, publicKey(CONFIG.candyMachine));
  const guard = await safeFetchCandyGuard(umi, cm.mintAuthority);
  const g = guard?.guards || {};
  const pay = opt(g.solPayment);
  const start = opt(g.startDate);
  const limit = opt(g.mintLimit);
  return {
    total: Number(cm.data.itemsAvailable),
    sold: Number(cm.itemsRedeemed),
    priceSol: pay ? Number(pay.lamports.basisPoints) / 1e9 : CONFIG.defaults.priceSol,
    treasury: pay ? pay.destination.toString() : null,
    startsAt: start ? Number(start.date) * 1000 : null,
    maxPerWallet: limit ? limit.limit : CONFIG.defaults.maxPerWallet,
    mintLimitId: limit ? limit.id : null,
    collection: cm.collectionMint.toString(),
  };
}

/** Mints `qty` licenses, one transaction each. Calls onProgress(i, qty) before each. */
export async function buyLicenses(wallet, sale, qty, onProgress) {
  const umi = makeUmi(wallet);
  const minted = [];
  for (let i = 0; i < qty; i++) {
    onProgress?.(i + 1, qty);
    const asset = generateSigner(umi);
    const mintArgs = {};
    if (sale.treasury) mintArgs.solPayment = some({ destination: publicKey(sale.treasury) });
    if (sale.mintLimitId !== null) mintArgs.mintLimit = some({ id: sale.mintLimitId });
    const { signature } = await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 800_000 }))
      .add(
        mintV1(umi, {
          candyMachine: publicKey(CONFIG.candyMachine),
          asset,
          collection: publicKey(sale.collection),
          mintArgs,
        })
      )
      .sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
    minted.push({ address: asset.publicKey.toString(), signature });
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
