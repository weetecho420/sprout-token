# Sprout Node (desktop)

A small Windows/Mac app that runs your Grower Nodes from the taskbar, so they keep earning without a browser tab open.

- **Pair once:** click *Pair this computer*, scan the QR code with your phone. It opens Phantom, you sign a free message, done.
- **Runs quietly:** closing the window keeps it running in the tray. It starts with the computer (you can switch that off) and sends one tiny check-in a minute, nothing else.
- **Pause / resume / unpair** from the window or the tray icon.
- The device key is stored encrypted with your system keychain. The app never sees your wallet's private key.

## Download

Get the latest installer from the repo's **Releases** page. New builds are made by GitHub Actions when a tag like `node-v0.1.1` is pushed (or via *Actions → Desktop node app → Run workflow*).

## Develop

```bash
cd desktop
npm install
npm start        # run the app
npm test         # node logic tests
npm run dist:win # build an installer locally (Windows)
```

Settings (network, server URL) are in `src/config.js`. Switch `NETWORK` to `mainnet` for the real sale.
