// All settings come from environment variables (see .env.example).
const env = import.meta.env;

const network = env.VITE_NETWORK === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';

export const CONFIG = {
  network,
  isDevnet: network === 'devnet',
  rpcUrl:
    env.VITE_RPC_URL ||
    (network === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com'),
  candyMachine: env.VITE_CANDY_MACHINE || '',
  // Shown until the Candy Machine is set up, and as a fallback
  defaults: {
    priceSol: 0.5,
    total: 1000,
    maxPerWallet: 5,
    startsAt: Date.parse('2027-03-01T00:00:00Z'),
  },
  stages: [
    { name: 'Seed', perDay: 50, afterDays: 0 },
    { name: 'Sprout', perDay: 75, afterDays: 7 },
    { name: 'Sapling', perDay: 110, afterDays: 21 },
    { name: 'Tree', perDay: 150, afterDays: 45 },
    { name: 'Hero', perDay: 200, afterDays: 90 },
  ],
  siteUrl: '/',
};

export function explorerUrl(kind, id) {
  const cluster = CONFIG.isDevnet ? '?cluster=devnet' : '';
  return `https://solscan.io/${kind}/${id}${cluster}`;
}
