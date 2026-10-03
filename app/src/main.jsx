import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import './styles.css';
import App from './App.jsx';
import { CONFIG } from './config';

// The private mainnet test should never show up in search engines
if (CONFIG.privateTest) {
  const m = document.createElement('meta');
  m.name = 'robots';
  m.content = 'noindex, nofollow';
  document.head.appendChild(m);
}

// Phantom, Solflare and other modern wallets register themselves
// (Wallet Standard), so no adapter list is needed.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={CONFIG.rpcUrl}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>
);
