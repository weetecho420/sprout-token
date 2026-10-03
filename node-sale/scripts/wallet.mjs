// Shows the deploy wallet's address and its SOL balance on the network in RPC_URL.
import fs from 'fs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';

const secret = JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'));
const umi = createUmi(process.env.RPC_URL);
const kp = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secret));
const bal = await umi.rpc.getBalance(kp.publicKey);
const net = /devnet/.test(process.env.RPC_URL) ? 'devnet' : 'MAINNET';
console.log(`\nDeploy wallet: ${kp.publicKey}`);
console.log(`Balance on ${net}: ${(Number(bal.basisPoints) / 1e9).toFixed(4)} SOL\n`);
