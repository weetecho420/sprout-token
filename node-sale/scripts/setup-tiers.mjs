// Creates the license collection and five Candy Machines, one per tier color.
// Each wallet can buy 1 from each machine, so its 1st license is Seedling, 2nd Bloom … 5th Evergreen.
// Every payment goes straight to TREASURY.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner, publicKey, some, sol, dateTime } from '@metaplex-foundation/umi';
import { mplCore, createCollection } from '@metaplex-foundation/mpl-core';
import { mplCandyMachine, create } from '@metaplex-foundation/mpl-core-candy-machine';

const here = path.dirname(fileURLToPath(import.meta.url));
const URIS = path.join(here, '../tier-uris.json');
const OUT = path.join(here, '../tier-sale.json');

const missing = ['RPC_URL', 'DEPLOYER_KEYPAIR', 'TREASURY'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}
if (!fs.existsSync(URIS)) {
  console.error('Run `npm run upload-tiers` first.');
  process.exit(1);
}
const { tiers, collectionUri } = JSON.parse(fs.readFileSync(URIS, 'utf8'));

const umi = createUmi(process.env.RPC_URL).use(mplCore()).use(mplCandyMachine());
const secret = JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'));
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secret))));

const TREASURY = publicKey(process.env.TREASURY);
const price = Number(process.env.PRICE_SOL || 0.5);
const start = process.env.SALE_START || '2027-03-01T00:00:00Z';
const total = tiers.reduce((s, t) => s + t.supply, 0);

console.log(`Network: ${process.env.RPC_URL.includes('devnet') ? 'DEVNET (test)' : 'MAINNET (real money)'}`);
console.log(`${price} SOL each · ${total} licenses in 5 colors · 1 of each color per wallet · opens ${start}`);
console.log(`Payments go to: ${TREASURY}\n`);

const collection = generateSigner(umi);
await createCollection(umi, { collection, name: 'Sprout Grower Nodes', uri: collectionUri }).sendAndConfirm(umi);
console.log(`Collection created`);

const machines = [];
for (const t of tiers) {
  const candyMachine = generateSigner(umi);
  const tx = await create(umi, {
    candyMachine,
    collection: collection.publicKey,
    collectionUpdateAuthority: umi.identity,
    itemsAvailable: t.supply,
    hiddenSettings: some({ name: `Grower Node ${t.name} #$ID+1$`, uri: t.uri, hash: new Uint8Array(32) }),
    guards: {
      solPayment: some({ lamports: sol(price), destination: TREASURY }),
      mintLimit: some({ id: 1, limit: 1 }),
      startDate: some({ date: dateTime(start) }),
    },
  });
  await tx.sendAndConfirm(umi);
  machines.push(candyMachine.publicKey.toString());
  console.log(`Candy Machine ${t.n} (${t.name}, ${t.supply}) created`);
}

const out = {
  VITE_COLLECTION: collection.publicKey.toString(),
  VITE_CANDY_MACHINES: machines.join(','),
  VITE_TREASURY: TREASURY.toString(),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('\nDone! Put these 3 in Netlify → Environment variables (also saved in node-sale/tier-sale.json):\n');
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
console.log('');
