// React hook for the "Confirm & Pay" button on the license checkout.
// Mints one license NFT per node; each mint sends the price in SOL to the treasury.
import { useWallet } from '@solana/wallet-adapter-react';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { generateSigner, publicKey, some, transactionBuilder } from '@metaplex-foundation/umi';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { mplCandyMachine, mintV1 } from '@metaplex-foundation/mpl-core-candy-machine';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';

const CANDY_MACHINE = publicKey(import.meta.env.VITE_CANDY_MACHINE);
const COLLECTION = publicKey(import.meta.env.VITE_COLLECTION);
const TREASURY = publicKey(import.meta.env.VITE_TREASURY);

export function usePayForNodes() {
  const wallet = useWallet();

  return async function payForNodes(qty) {
    const umi = createUmi(import.meta.env.VITE_RPC_URL)
      .use(mplCore())
      .use(mplCandyMachine())
      .use(walletAdapterIdentity(wallet));

    const minted = [];
    for (let i = 0; i < qty; i++) {
      const asset = generateSigner(umi);
      await transactionBuilder()
        .add(setComputeUnitLimit(umi, { units: 800_000 }))
        .add(
          mintV1(umi, {
            candyMachine: CANDY_MACHINE,
            asset,
            collection: COLLECTION,
            mintArgs: {
              solPayment: some({ destination: TREASURY }),
              mintLimit: some({ id: 1 }),
            },
          })
        )
        .sendAndConfirm(umi);
      minted.push(asset.publicKey);
    }
    return minted; // license addresses
  };
}

// Lists the Grower Node licenses a wallet owns (Helius DAS API).
export async function getMyNodes(owner) {
  const res = await fetch(import.meta.env.VITE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'nodes',
      method: 'getAssetsByOwner',
      params: { ownerAddress: owner, page: 1, limit: 100 },
    }),
  });
  const { result } = await res.json();
  return result.items.filter((a) =>
    a.grouping?.some((g) => g.group_key === 'collection' && g.group_value === import.meta.env.VITE_COLLECTION)
  );
}
