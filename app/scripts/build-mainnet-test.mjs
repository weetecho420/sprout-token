// Builds the private mainnet test copy of the app into site/mainnet-test.
// Settings come from app/mainnet-test.json, never from the Netlify (devnet) variables.
import { spawnSync } from 'child_process';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync(new URL('../mainnet-test.json', import.meta.url), 'utf8'));
const env = {
  ...process.env,
  APP_BASE: '/mainnet-test/',
  APP_OUT: '../site/mainnet-test',
  VITE_NETWORK: 'mainnet-beta',
  VITE_PRIVATE_TEST: '1',
  VITE_RPC_URL: cfg.rpcUrl,
  VITE_CANDY_MACHINES: cfg.candyMachines || '',
  VITE_CANDY_MACHINE: '',
};
const r = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
