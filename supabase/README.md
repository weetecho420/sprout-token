# Sprout Node backend (Supabase)

Tracks which Grower Nodes are online and how much $SPROUT each has earned.

- `migrations/` — tables: `sprout_config` (license collection + RPC), `sprout_nodes` (uptime, earnings), `sprout_sessions`.
- `functions/sprout-node/` — Edge Function with three actions:
  - `login`: the wallet signs a free message once; the server checks the signature and that the wallet owns licenses in the collection (read straight from Solana), then returns a 24-hour session token.
  - `heartbeat`: sent every minute by the Run Node page; credits online time. Gaps over 3 minutes count as offline. Ownership is re-checked every 10 minutes, so a sold license stops earning for the seller.
  - `stop`: credits the last stretch and marks the nodes offline.

Earnings follow the stage ladder by total online time: Seed 50/day, Sprout 75 (7 days), Sapling 110 (21), Tree 150 (45), Hero 200 (90).

## Switching networks

For mainnet, update the one config row:

```sql
update sprout_config set collection = '<mainnet collection address>', rpc_url = 'https://api.mainnet-beta.solana.com' where id = 1;
```

Earnings are tracked here only. Paying them out in $SPROUT (the Claim button) comes after the token launches.
