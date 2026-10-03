import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getMyLicenses } from './solana';
import { startNode, heartbeat, stopNode, stageFor, nodeNetworkReady, HEARTBEAT_MS, DESKTOP_DOWNLOAD_URL } from './node';
import { duration, sprout, fmt } from './format';
import { Leaf } from './icons.jsx';

const TOKEN_KEY = 'sprout-node-session';

function readSaved(owner) {
  try {
    const s = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return s && s.owner === owner ? s.token : null;
  } catch {
    return null;
  }
}
function save(owner, token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ owner, token }));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the node still runs, it just won't survive a refresh */
  }
}

/** Keeps the screen on while the node runs (where the browser allows it). */
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock = null;
    const grab = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {});
    grab();
    const onVis = () => document.visibilityState === 'visible' && grab();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

export default function RunPage({ sale, now }) {
  const wallet = useWallet();
  const owner = wallet.publicKey?.toBase58();
  const [licenses, setLicenses] = useState({ loading: false, items: [], error: '' });
  const [token, setToken] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [beatAt, setBeatAt] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | starting | running | reconnecting | stopping
  const [error, setError] = useState('');
  const tokenRef = useRef(null);
  tokenRef.current = token;

  useWakeLock(status === 'running' || status === 'reconnecting');

  // Load this wallet's licenses
  useEffect(() => {
    setToken(null);
    setNodes([]);
    setStatus('idle');
    setError('');
    if (!owner || !sale.collection) return;
    let alive = true;
    setLicenses({ loading: true, items: [], error: '' });
    getMyLicenses(owner, sale.collection)
      .then((items) => alive && setLicenses({ loading: false, items, error: '' }))
      .catch(() => alive && setLicenses({ loading: false, items: [], error: "Couldn't load your licenses. Try again in a minute." }));
    // Pick up a node that was already running in this tab before a refresh
    const saved = readSaved(owner);
    if (saved) {
      setToken(saved);
      setStatus('reconnecting');
      setStartedAt(Date.now());
    }
    return () => {
      alive = false;
    };
  }, [owner, sale.collection]);

  const applyNodes = (list) => {
    setNodes(list);
    setBeatAt(Date.now());
  };

  const beat = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const res = await heartbeat(t);
      applyNodes(res.nodes);
      setStatus('running');
      setError('');
    } catch (e) {
      if (e.retry) {
        setStatus('reconnecting');
      } else {
        save(owner, null);
        setToken(null);
        setStatus('idle');
        setError(e.message);
      }
    }
  }, [owner]);

  // Heartbeat loop, plus an immediate beat whenever the page comes back into view
  useEffect(() => {
    if (!token) return;
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    const onVis = () => document.visibilityState === 'visible' && beat();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token, beat]);

  async function start() {
    setError('');
    setStatus('starting');
    try {
      const res = await startNode(wallet, licenses.items.map((l) => l.address));
      save(owner, res.token);
      applyNodes(res.nodes);
      setStartedAt(Date.now());
      setToken(res.token);
      setStatus('running');
    } catch (e) {
      setStatus('idle');
      setError(e.message);
    }
  }

  async function stop() {
    setStatus('stopping');
    try {
      const res = await stopNode(token);
      if (res.nodes?.length) setNodes(res.nodes);
    } catch {
      /* it will time out to offline on its own */
    }
    save(owner, null);
    setToken(null);
    setBeatAt(null);
    setStatus('idle');
  }

  // ---- screens ----
  if (!owner) {
    return (
      <div className="stack">
        <section className="card center">
          <h1 className="h-md">Run your node</h1>
          <p className="muted">Connect the wallet that holds your Grower Node license.</p>
          <WalletMultiButton />
        </section>
      </div>
    );
  }
  if (!sale.configured || !nodeNetworkReady()) {
    return (
      <div className="stack">
        <section className="card center">
          <h1 className="h-md">Run your node</h1>
          <p className="muted">The node network opens soon. Check back after the sale starts.</p>
        </section>
      </div>
    );
  }
  if (licenses.loading) {
    return (
      <div className="stack">
        <section className="card center">
          <p className="muted">Checking your licenses…</p>
        </section>
      </div>
    );
  }
  if (!licenses.items.length) {
    return (
      <div className="stack">
        <section className="card center">
          <h1 className="h-md">Run your node</h1>
          <p className="muted">{licenses.error || 'You need a Grower Node license to run a node.'}</p>
          {!licenses.error && (
            <a className="btn primary" href="#/buy">
              Get a license
            </a>
          )}
        </section>
      </div>
    );
  }

  const on = status === 'running' || status === 'reconnecting' || status === 'stopping';
  const perDay = nodes.reduce((sum, n) => sum + stageFor(n.uptimeSeconds).perDay, 0);
  const sinceBeat = on && beatAt ? Math.max(0, (now - beatAt) / 1000) : 0;
  const earned = nodes.reduce((sum, n) => sum + n.earned, 0) + (sinceBeat / 86400) * perDay;
  const lead = nodes[0] ? stageFor(nodes[0].uptimeSeconds + sinceBeat) : stageFor(0);
  const count = on ? nodes.length : licenses.items.length;

  return (
    <div className="stack">
      <section className="hero compact">
        <span className="eyebrow">Sprout Node</span>
        <h1 className="h-md">Run your node</h1>
      </section>

      <section className={`card runner ${on ? 'on' : ''}`} aria-live="polite">
        <div className="orb" aria-hidden="true">
          <Leaf size={56} />
        </div>
        <div className="run-state">
          <span className={`state ${status === 'running' ? 'good' : ''}`}>
            {status === 'running' && 'Online'}
            {status === 'reconnecting' && 'Reconnecting…'}
            {status === 'starting' && 'Check your wallet to sign in…'}
            {status === 'stopping' && 'Stopping…'}
            {status === 'idle' && 'Offline'}
          </span>
          <span className="muted small">
            {fmt(count)} {count === 1 ? 'node' : 'nodes'} · {lead.name} stage
          </span>
        </div>

        <div className="grid2">
          <div className="stat">
            <span className="label">Earned so far</span>
            <strong className="num">{sprout(earned)}</strong>
          </div>
          <div className="stat">
            <span className="label">This session</span>
            <strong className="num">{on && startedAt ? duration((now - startedAt) / 1000) : '–'}</strong>
          </div>
        </div>

        {on ? (
          <button type="button" className="btn ghost" onClick={stop} disabled={status === 'stopping'}>
            Stop node
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={start} disabled={status === 'starting'}>
            Start node
          </button>
        )}
      </section>

      {error && (
        <p className="alert bad" role="alert">
          {error}
        </p>
      )}

      <section className="card">
        <h2 className="h-sm">Growing to {lead.next ? lead.next.name : 'Hero'}</h2>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${Math.round(lead.progress * 100)}%` }} />
        </div>
        <p className="muted small">
          {lead.next
            ? `Earning ${lead.perDay} $SPROUT a day per node. Reaches ${lead.next.name} (${lead.next.perDay}/day) after ${lead.next.afterDays} days online.`
            : `Top stage: ${lead.perDay} $SPROUT a day per node.`}
        </p>
      </section>

      <section className="card desktop-cta">
        <h2 className="h-sm">Run it all day on your computer</h2>
        <p className="muted small">
          The Sprout Node desktop app sits in your taskbar, starts with your computer and keeps your nodes online without
          this page open. Pair it once by scanning a code with this phone.
        </p>
        <a className="btn ghost" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noopener">
          Get the desktop app (Windows / Mac)
        </a>
      </section>

      <section className="card">
        <h2 className="h-sm">Keep it running</h2>
        <ul className="how">
          <li>
            <b>Keep this page open</b> with the screen on. Phones pause pages in the background, and paused time doesn't count.
          </li>
          <li>
            <b>Plug in your charger</b> if you run it for hours.
          </li>
          <li>
            Earnings are saved every minute. Claiming opens after $SPROUT launches.
          </li>
        </ul>
      </section>
    </div>
  );
}
