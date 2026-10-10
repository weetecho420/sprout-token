// All settings come from environment variables (see .env.example).
const env = import.meta.env;

const network = env.VITE_NETWORK === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';

export const CONFIG = {
  network,
  // Private real-money test build (see app/mainnet-test.json). Not linked anywhere public.
  privateTest: env.VITE_PRIVATE_TEST === '1',
  isDevnet: network === 'devnet',
  rpcUrl:
    env.VITE_RPC_URL ||
    (network === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com'),
  // One Candy Machine per tier color (VITE_CANDY_MACHINES, comma-separated, Seedling first).
  // VITE_CANDY_MACHINE still works for the original single-color sale.
  candyMachines: (env.VITE_CANDY_MACHINES || env.VITE_CANDY_MACHINE || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  get candyMachine() {
    return this.candyMachines[0] || '';
  },
  // Sprout Node backend (Supabase). Both values are public by design.
  supabaseUrl: env.VITE_SUPABASE_URL || 'https://dmfhvxrxkilszdrbghqh.supabase.co',
  supabaseKey: env.VITE_SUPABASE_KEY || 'sb_publishable_xBOm_D5LW7ifZIxFuYlIgw_b_7Gtexh',
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
  // Pay with Sprout (#/pay). Until $SPROUT launches there is no mint, so the page takes
  // test SOL on this app's network instead. Set VITE_SPROUT_MINT after launch.
  sproutMint: env.VITE_SPROUT_MINT || '',
  sproutDecimals: Number(env.VITE_SPROUT_DECIMALS || 6),
};

export function explorerUrl(kind, id) {
  const cluster = CONFIG.isDevnet ? '?cluster=devnet' : '';
  return `https://solscan.io/${kind}/${id}${cluster}`;
}
