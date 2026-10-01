# Sprout Grower Node sale

Scripts that create the Grower Node license NFTs and the Candy Machine that sells them. Each license costs 0.5 SOL, and every payment goes straight to the Sprout treasury (a Squads multisig vault).

**Always run everything on devnet first.** Only switch `RPC_URL` to mainnet for the real sale.

## Setup

1. Install [Node.js](https://nodejs.org) 20 or newer and the [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools).
2. Make a deploy wallet, outside this repo:
   ```bash
   solana-keygen new -o ~/sprout-deployer.json
   solana config set --keypair ~/sprout-deployer.json --url devnet
   solana airdrop 2
   ```
3. Install and configure:
   ```bash
   cd node-sale
   npm install
   cp .env.example .env   # then fill in RPC_URL, DEPLOYER_KEYPAIR, TREASURY
   ```

## Create the sale

```bash
npm run upload   # uploads the license image + metadata, prints LICENSE_URI and COLLECTION_URI
npm run setup    # creates the collection and Candy Machine, prints the addresses
```

Copy the URIs from `upload` into `.env` before running `setup`. Save the addresses `setup` prints; the website needs them.

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
