import { useCallback, useEffect, useMemo, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { CONFIG } from './config';
import { loadSale } from './solana';
import SalePage from './SalePage.jsx';
import CheckoutPage from './CheckoutPage.jsx';
import NodesPage from './NodesPage.jsx';
import RunPage from './RunPage.jsx';
import PairPage from './PairPage.jsx';
import LoungePage from './LoungePage.jsx';
import PayPage from './PayPage.jsx';
import { Leaf, IconSale, IconBuy, IconNodes, IconRun, IconChat } from './icons.jsx';

const ROUTES = { '': 'sale', buy: 'buy', run: 'run', nodes: 'nodes', pair: 'pair', lounge: 'lounge', pay: 'pay' };

function useRoute() {
  const read = () => ROUTES[window.location.hash.replace(/^#\/?/, '').split('?')[0]] || 'sale';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function App() {
  const route = useRoute();
  const now = useNow();
  const [chain, setChain] = useState({ loading: !!CONFIG.candyMachine, data: null, error: '' });

  const refresh = useCallback(async () => {
    if (!CONFIG.candyMachine) return;
    try {
      const data = await loadSale();
      setChain({ loading: false, data, error: '' });
    } catch (e) {
      console.error(e);
      setChain({ loading: false, data: null, error: "Couldn't reach the sale right now. Refresh the page to try again." });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // One view of the sale that works before and after the Candy Machine exists
  const sale = useMemo(() => {
    const d = chain.data;
    const startsAt = d?.startsAt ?? (d ? null : CONFIG.defaults.startsAt);
    const total = d?.total ?? CONFIG.defaults.total;
    const sold = d?.sold ?? 0;
    return {
      ...(d || {}),
      configured: !!d,
      loading: chain.loading,
      error: chain.error,
      priceSol: d?.priceSol ?? CONFIG.defaults.priceSol,
      maxPerWallet: d?.maxPerWallet ?? CONFIG.defaults.maxPerWallet,
      total,
      sold,
      remaining: Math.max(0, total - sold),
      startsAt,
      isLive: !!d && (!startsAt || now >= startsAt) && sold < total,
      soldOut: !!d && sold >= total,
    };
  }, [chain, now]);

  return (
    <div className={`shell ${route === 'pay' ? 'shell-pay' : ''}`}>
      {CONFIG.isDevnet && (
        <div className="testbar" role="note">
          Beta on devnet. Uses free test SOL, not real money.{' '}
          <a href="/beta/">How to join</a>
        </div>
      )}
      {CONFIG.privateTest && (
        <div className="testbar real" role="note">
          Private test with REAL SOL on mainnet. Don't share this link.
        </div>
      )}
      <header className="top">
        <a href="#/" className="brand" aria-label="Node Sale home">
          <Leaf size={28} />
          <span>{route === 'pay' ? 'Sprout Pay' : 'Node Sale'}</span>
        </a>
        {route !== 'pay' && <WalletMultiButton />}
      </header>

      <main className="main">
        {route === 'sale' && <SalePage sale={sale} now={now} />}
        {route === 'buy' && <CheckoutPage sale={sale} now={now} onBought={refresh} />}
        {route === 'run' && <RunPage sale={sale} now={now} />}
        {route === 'pair' && <PairPage sale={sale} />}
        {route === 'lounge' && <LoungePage sale={sale} />}
        {route === 'nodes' && <NodesPage sale={sale} now={now} />}
        {route === 'pay' && <PayPage />}
      </main>

      {route !== 'pay' && (
      <footer className="foot">
        <a href={CONFIG.siteUrl}>Back to sprouttoken.netlify.app</a>
        <span>Rewards are estimates, not guaranteed. Not financial advice.</span>
      </footer>
      )}

      {route !== 'pay' && (
      <nav className="tabs" aria-label="Main">
        <a href="#/" aria-current={route === 'sale' ? 'page' : undefined}>
          <IconSale />
          Sale
        </a>
        <a href="#/buy" aria-current={route === 'buy' ? 'page' : undefined}>
          <IconBuy />
          Buy
        </a>
        <a href="#/run" aria-current={route === 'run' || route === 'pair' ? 'page' : undefined}>
          <IconRun />
          Run
        </a>
        <a href="#/lounge" aria-current={route === 'lounge' ? 'page' : undefined}>
          <IconChat />
          Lounge
        </a>
        <a href="#/nodes" aria-current={route === 'nodes' ? 'page' : undefined}>
          <IconNodes />
          Nodes
        </a>
      </nav>
      )}
    </div>
  );
}
