// Uploads the five tier images and their metadata, and saves the links to tier-uris.json
// so `npm run setup-tiers` can use them. No copy-pasting needed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { keypairIdentity, createGenericFile } from '@metaplex-foundation/umi';
import { TIERS } from '../../nft/tiers/make-tiers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAINNET = !/devnet/.test(process.env.RPC_URL || '');
const OUT = path.join(here, MAINNET ? '../tier-uris.mainnet.json' : '../tier-uris.json');

for (const k of ['RPC_URL', 'DEPLOYER_KEYPAIR']) {
  if (!process.env[k]) {
    console.error(`Missing in .env: ${k}`);
    process.exit(1);
  }
}

console.log(`Network: ${MAINNET ? 'MAINNET (uses a little real SOL for storage)' : 'DEVNET (test)'}\n`);
const umi = createUmi(process.env.RPC_URL).use(irysUploader());
const secret = JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'));
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secret))));

const ordinal = ['1st', '2nd', '3rd', '4th', '5th'];
const result = { tiers: [] };

for (const t of TIERS) {
  const file = path.join(here, `../../nft/tiers/tier-${t.n}-${t.slug}.png`);
  process.stdout.write(`Uploading Tier ${t.roman} · ${t.name}… `);
  const [image] = await umi.uploader.upload([
    createGenericFile(fs.readFileSync(file), `tier-${t.n}-${t.slug}.png`, { contentType: 'image/png' }),
  ]);
  const uri = await umi.uploader.uploadJson({
    name: `Grower Node · ${t.name}`,
    symbol: 'SPRNODE',
    description:
      `Tier ${t.roman} Sprout Grower Node license (${t.name}), the color a wallet gets with its ${ordinal[t.n - 1]} license. ` +
      `${t.line} Every Grower Node earns the same $SPROUT whatever its color. Rewards are estimates, not guaranteed.`,
    image,
    external_url: 'https://sprouttoken.netlify.app',
    attributes: [
      { trait_type: 'Tier', value: `${t.roman} · ${t.name}` },
      { trait_type: 'Color', value: t.color },
      { trait_type: 'Tier supply', value: String(t.supply) },
    ],
    properties: { files: [{ uri: image, type: 'image/png' }], category: 'image' },
  });
  result.tiers.push({ n: t.n, name: t.name, supply: t.supply, uri, image });
  console.log('done');
}

const first = result.tiers[0];
result.collectionUri = await umi.uploader.uploadJson({
  name: 'Sprout Grower Nodes',
  symbol: 'SPRNODE',
  description: 'Official Sprout Grower Node licenses, in five colors: Seedling, Bloom, Canopy, Grove and Evergreen.',
  image: first.image,
  external_url: 'https://sprouttoken.netlify.app',
});

fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nAll uploaded. Links saved to node-sale/${path.basename(OUT)}\nNext: npm run ${MAINNET ? 'setup-tiers:mainnet' : 'setup-tiers'}\n`);
