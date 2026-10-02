// Creates the deploy wallet file without needing the Solana CLI.
// Saves it in your home folder (outside this repo) and prints the address.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';

const file = path.join(os.homedir(), 'sprout-deployer.json');

if (fs.existsSync(file)) {
  console.log(`\nA deploy wallet already exists at:\n  ${file}\nNot replacing it (that would lose access to anything in it).\n`);
  process.exit(0);
}

const umi = createUmi('https://api.devnet.solana.com');
const kp = umi.eddsa.generateKeypair();
fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });

console.log('\nDeploy wallet created.\n');
console.log(`Address (safe to share):\n  ${kp.publicKey}\n`);
console.log(`Wallet file (keep private, never share or upload):\n  ${file}\n`);
console.log('Next:');
console.log('  1. Put this line in node-sale/.env:');
console.log(`     DEPLOYER_KEYPAIR=${file}`);
console.log('  2. Get free devnet SOL: open https://faucet.solana.com,');
console.log('     paste the address above, choose Devnet, and request 2 SOL.\n');
