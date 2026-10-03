# Sprout Grower Node sale

Scripts that create the Grower Node license NFTs and the Candy Machine that sells them. Each license costs 0.5 SOL, and every payment goes straight to the Sprout treasury (a Squads multisig vault).

**Always run everything on devnet first.** Only switch `RPC_URL` to mainnet for the real sale.

## Setup (Windows, Mac or Linux)

1. Install [Node.js](https://nodejs.org) 22 LTS. No Solana CLI needed.
2. Open a terminal in this `node-sale` folder and run:
   ```bash
   npm install
   npm run new-wallet
   ```
   This creates your deploy wallet in your home folder (outside the repo) and prints its address.
3. Get free devnet SOL: open [faucet.solana.com](https://faucet.solana.com), paste the address, pick **Devnet**, request 2 SOL.
4. Copy `.env.example` to `.env` (Windows: `copy .env.example .env`) and fill in `RPC_URL`, `DEPLOYER_KEYPAIR` (the path `new-wallet` printed) and `TREASURY` (your wallet address).

## Create the sale

```bash
npm run upload   # uploads the license image + metadata, prints LICENSE_URI and COLLECTION_URI
npm run setup    # creates the collection and Candy Machine, prints the addresses
```

Copy the URIs from `upload` into `.env` before running `setup`. Save the addresses `setup` prints; the website needs them.

## Five-color sale (Seedling → Evergreen)

Each wallet's 1st license is Seedling (green), 2nd Bloom (aqua), 3rd Canopy (blue), 4th Grove (purple), 5th Evergreen (gold).

```bash
npm run upload-tiers   # uploads the 5 tier images + metadata, saves links to tier-uris.json
npm run setup-tiers    # creates the collection + 5 Candy Machines, prints 3 Netlify settings
```

Put the three printed values (`VITE_COLLECTION`, `VITE_CANDY_MACHINES`, `VITE_TREASURY`) in Netlify, then redeploy. Supplies: 500 / 250 / 150 / 70 / 30 = 1,000.

## Private real-money test (mainnet)

Uses `.env.mainnet`, so your devnet setup is never touched.

```bash
copy .env.mainnet.example .env.mainnet   # then fill it in (PRICE_SOL=0.01, TREASURY = your Phantom)
npm run wallet:mainnet                   # shows the deploy wallet address + real SOL balance (needs ~0.15 SOL)
npm run upload-tiers:mainnet
npm run setup-tiers:mainnet              # asks you to type YES
```

Send the printed `VITE_COLLECTION` and `VITE_CANDY_MACHINES` to Claude. They go in `app/mainnet-test.json`, and the private test app appears at `/mainnet-test/` (not linked anywhere, hidden from search engines).

## Sale settings (in `.env`)

| Setting | Default |
|---|---|
| `PRICE_SOL` | 0.5 |
| `TOTAL_LICENSES` | 1000 |
| `MAX_PER_WALLET` | 5 |
| `SALE_START` | 2027-03-01 (after $SPROUT launches on 27 Jan 2027) |

## Website code

`web/usePayForNodes.js` has the checkout's pay function and the dashboard's "which licenses do I own" lookup. Put the addresses from `setup` in the web app's environment variables (`VITE_CANDY_MACHINE`, `VITE_COLLECTION`, `VITE_TREASURY`, `VITE_RPC_URL`).

## Safety

- Never commit `.env` or any wallet file. `.gitignore` blocks them, but double-check before every commit.
- Metaplex updates its libraries often. If a function name errors, check [developers.metaplex.com](https://developers.metaplex.com).
