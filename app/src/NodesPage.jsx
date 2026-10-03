import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getMyLicenses } from './solana';
import { getNodeStatus, isOnline, stageFor } from './node';
import { explorerUrl } from './config';
import { duration, sprout } from './format';
import { IconExternal } from './icons.jsx';

export default function NodesPage({ sale, now }) {
  const { publicKey } = useWallet();
  const [state, setState] = useState({ loading: false, items: [], error: '' });
  const owner = publicKey?.toBase58();
  const [status, setStatus] = useState({});

  // Online status, uptime and earnings from the node network (refreshes every 30s)
  useEffect(() => {
    if (!owner) return;
    let alive = true;
    const load = () =>
      getNodeStatus(owner)
        .then((list) => alive && setStatus(Object.fromEntries(list.map((n) => [n.asset, n]))))
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [owner]);

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

  const unclaimed = state.items.reduce((sum, n) => sum + (status[n.address]?.earned || 0), 0);
  const onlineCount = state.items.filter((n) => isOnline(status[n.address], now)).length;

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
            <strong className="num">{sprout(unclaimed)}</strong>
          </div>
        </div>
        <a className="btn primary" href="#/run">
          {onlineCount ? `${onlineCount} online · open node` : 'Run your node'}
        </a>
        <button type="button" className="btn ghost" disabled>
          Claim $SPROUT
        </button>
        <p className="muted small">Earnings are saved while your node runs. Claiming opens after $SPROUT launches.</p>
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

      {state.items.map((n) => {
        const st = status[n.address];
        const online = isOnline(st, now);
        const stage = stageFor(st?.uptimeSeconds || 0);
        return (
        <section className="card node" key={n.address}>
          <div className="node-top">
            <div>
              <strong>{n.name}</strong>
              <span className="muted small">
                {stage.name} · {st ? `${duration(st.uptimeSeconds)} online · ${sprout(st.earned)} earned` : 'never run yet'}
              </span>
            </div>
            <span className={`pill ${online ? 'on' : ''}`}>{online ? `Online · +${stage.perDay}/day` : 'Offline'}</span>
          </div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${Math.round(stage.progress * 100)}%` }} />
          </div>
          <a className="small link" href={explorerUrl('token', n.address)} target="_blank" rel="noopener">
            View license on Solscan <IconExternal />
          </a>
        </section>
        );
      })}
    </div>
  );
}
