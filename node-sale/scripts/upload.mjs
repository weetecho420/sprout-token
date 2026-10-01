// Uploads the license artwork and metadata, then prints the two URIs for .env.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { keypairIdentity, createGenericFile } from '@metaplex-foundation/umi';

const here = path.dirname(fileURLToPath(import.meta.url));
const IMAGE = path.join(here, '../../nft/grower-node-license.png');

const umi = createUmi(process.env.RPC_URL).use(irysUploader());
const secret = JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'));
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secret))));

const [image] = await umi.uploader.upload([
  createGenericFile(fs.readFileSync(IMAGE), 'grower-node-license.png', { contentType: 'image/png' }),
]);

const licenseUri = await umi.uploader.uploadJson({
  name: 'Grower Node License',
  symbol: 'SPRNODE',
  description: 'A Sprout Grower Node license. Run a node, grow from Seed to Hero, and earn $SPROUT while it stays online. Rewards are estimates, not guaranteed.',
  image,
  external_url: 'https://sprouttoken.netlify.app',
  attributes: [
    { trait_type: 'Tier', value: 'Grower' },
    { trait_type: 'Supply', value: process.env.TOTAL_LICENSES || '1000' },
  ],
  properties: { files: [{ uri: image, type: 'image/png' }], category: 'image' },
});

const collectionUri = await umi.uploader.uploadJson({
  name: 'Sprout Grower Nodes',
  symbol: 'SPRNODE',
  description: 'Official Sprout Grower Node licenses.',
  image,
  external_url: 'https://sprouttoken.netlify.app',
});

console.log('\nAdd these to node-sale/.env:\n');
console.log(`LICENSE_URI=${licenseUri}`);
console.log(`COLLECTION_URI=${collectionUri}\n`);
