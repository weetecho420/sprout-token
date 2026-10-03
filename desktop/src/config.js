// Public settings for the Sprout Node network. Nothing secret lives here.
module.exports = {
  NETWORK: 'devnet', // change to 'mainnet' for the real network
  SUPABASE_URL: 'https://dmfhvxrxkilszdrbghqh.supabase.co',
  SUPABASE_KEY: 'sb_publishable_xBOm_D5LW7ifZIxFuYlIgw_b_7Gtexh',
  APP_URL: 'https://sprouttoken.netlify.app/app/',

  HEARTBEAT_MS: 60 * 1000, // one tiny check-in a minute
  RETRY_MS: 30 * 1000, // after a network hiccup
  PAIR_POLL_MS: 3 * 1000,

  // Seed → Hero, same ladder as the website (days of total online time)
  STAGES: [
    { name: 'Seed', perDay: 50, afterDays: 0 },
    { name: 'Sprout', perDay: 75, afterDays: 7 },
    { name: 'Sapling', perDay: 110, afterDays: 21 },
    { name: 'Tree', perDay: 150, afterDays: 45 },
    { name: 'Hero', perDay: 200, afterDays: 90 },
  ],
};
