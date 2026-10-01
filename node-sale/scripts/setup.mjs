// Creates the license collection and the Candy Machine that sells licenses.
// Every payment goes straight to TREASURY (your Squads vault).
import fs from 'fs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner, publicKey, some, sol, dateTime } from '@metaplex-foundation/umi';
import { mplCore, createCollection } from '@metaplex-foundation/mpl-core';
import { mplCandyMachine, create } from '@metaplex-foundation/mpl-core-candy-machine';

const need = ['RPC_URL', 'DEPLOYER_KEYPAIR', 'TREASURY', 'LICENSE_URI', 'COLLECTION_URI'];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

const umi = createUmi(process.env.RPC_URL).use(mplCore()).use(mplCandyMachine());
const secret = JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'));
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secret))));

const TREASURY = publicKey(process.env.TREASURY);
const price = Number(process.env.PRICE_SOL || 0.5);
const total = Number(process.env.TOTAL_LICENSES || 1000);
const perWallet = Number(process.env.MAX_PER_WALLET || 5);
const start = process.env.SALE_START || '2027-03-01T00:00:00Z';

console.log(`Network: ${process.env.RPC_URL.includes('devnet') ? 'DEVNET (test)' : 'MAINNET (real money)'}`);
console.log(`Price ${price} SOL · ${total} licenses · max ${perWallet} per wallet · opens ${start}`);
console.log(`Payments go to: ${TREASURY}\n`);

// 1. The collection every license belongs to
const collection = generateSigner(umi);
await createCollection(umi, {
  collection,
  name: 'Sprout Grower Nodes',
  uri: process.env.COLLECTION_URI,
}).sendAndConfirm(umi);
console.log('Collection created');

// 2. The Candy Machine that sells licenses
const candyMachine = generateSigner(umi);
const tx = await create(umi, {
  candyMachine,
  collection: collection.publicKey,
  collectionUpdateAuthority: umi.identity,
  itemsAvailable: total,
  hiddenSettings: some({
    name: 'Grower Node #$ID+1$',
    uri: process.env.LICENSE_URI,
    hash: new Uint8Array(32),
  }),
  guards: {
    solPayment: some({ lamports: sol(price), destination: TREASURY }),
    mintLimit: some({ id: 1, limit: perWallet }),
    startDate: some({ date: dateTime(start) }),
  },
});
await tx.sendAndConfirm(umi);
console.log('Candy Machine created\n');

console.log('Save these for the website (.env of the web app):');
console.log(`VITE_COLLECTION=${collection.publicKey}`);
console.log(`VITE_CANDY_MACHINE=${candyMachine.publicKey}`);
console.log(`VITE_TREASURY=${TREASURY}\n`);
