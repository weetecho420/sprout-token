import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getMyLicenses } from './solana';
import { explorerUrl } from './config';
import { IconExternal } from './icons.jsx';

export default function NodesPage({ sale }) {
  const { publicKey } = useWallet();
  const [state, setState] = useState({ loading: false, items: [], error: '' });
  const owner = publicKey?.toBase58();

  useEffect(() => {
    if (!owner || !sale.collection) return;
    let alive = true;
    setState({ loading: true, items: [], error: '' });
    getMyLicenses(owner, sale.collection)
      .then((items) => alive && setState({ loading: false, items, error: '' }))
      .catch((e) => {
        console.error(e);
        alive &&
          setState({
            loading: false,
            items: [],
            error: "Couldn't load your licenses. They're safe in your wallet; this page just couldn't list them. Try again in a minute.",
          });
      });
    return () => {
      alive = false;
    };
  }, [owner, sale.collection]);

  if (!owner) {
    return (
      <div className="stack">
        <section className="card center">
          <h1 className="h-md">My Nodes</h1>
          <p className="muted">Connect the wallet you bought your licenses with to see your nodes.</p>
          <WalletMultiButton />
        </section>
      </div>
    );
  }

  if (!sale.configured) {
    return (
      <div className="stack">
        <section className="card center">
          <h1 className="h-md">My Nodes</h1>
          <p className="muted">Your nodes will show here once the sale opens.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="hero compact">
        <span className="eyebrow">Your garden</span>
        <h1 className="h-md">My Nodes</h1>
      </section>

      <section className="card earned">
        <div className="grid2">
          <div className="stat">
            <span className="label">Licenses</span>
            <strong className="num">{state.loading ? '…' : state.items.length}</strong>
          </div>
          <div className="stat">
            <span className="label">Unclaimed $SPROUT</span>
            <strong className="num">0</strong>
          </div>
        </div>
        <button type="button" className="btn ghost" disabled>
          Claim $SPROUT
        </button>
        <p className="muted small">Rewards start once the Sprout Node app is live and your node is online.</p>
      </section>

      {state.error && <p className="alert bad">{state.error}</p>}

      {!state.loading && !state.error && state.items.length === 0 && (
        <section className="card center">
          <p className="muted">No Grower Node licenses in this wallet yet.</p>
          <a className="btn primary" href="#/buy">
            Get a license
          </a>
        </section>
      )}

      {state.items.map((n) => (
        <section className="card node" key={n.address}>
          <div className="node-top">
            <div>
              <strong>{n.name}</strong>
              <span className="muted small">Seed · waiting for the node app</span>
            </div>
            <span className="pill">+0/day</span>
          </div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: '0%' }} />
          </div>
          <a className="small link" href={explorerUrl('token', n.address)} target="_blank" rel="noopener">
            View license on Solscan <IconExternal />
          </a>
        </section>
      ))}
    </div>
  );
}
