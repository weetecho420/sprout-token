# Sprout Node Sale app

The web app where people buy Grower Node licenses and see their nodes. It lives at **sprouttoken.netlify.app/app/**.

- **Node Sale**: price, licenses sold, countdown to the sale, rewards by stage
- **Buy**: pick 1–5 nodes, connect Phantom or Solflare, pay in SOL. Each license is minted from the Candy Machine and the SOL goes straight to the Squads treasury.
- **My Nodes**: lists the license NFTs in the connected wallet

Netlify builds it automatically (see `netlify.toml`). Until `VITE_CANDY_MACHINE` is set, the app shows the planned sale and the Pay button stays off.

## Settings (Netlify → Project configuration → Environment variables)

| Variable | Value |
|---|---|
| `VITE_NETWORK` | `devnet` while testing, `mainnet-beta` for the real sale |
| `VITE_RPC_URL` | Your Helius RPC URL for that network |
| `VITE_CANDY_MACHINE` | The address printed by `npm run setup` in `node-sale/` |

Price, supply, per-wallet limit, start date and treasury are read from the Candy Machine itself, so the app always matches the real sale.

## Run it on your computer

```bash
cd app
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```
