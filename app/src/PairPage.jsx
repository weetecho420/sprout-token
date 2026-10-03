import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getMyLicenses } from './solana';
import { approvePairing } from './node';
import { Leaf } from './icons.jsx';

const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export function readPairCode() {
  const q = window.location.hash.split('?')[1] || '';
  return (new URLSearchParams(q).get('code') || '').toUpperCase().trim();
}

export default function PairPage({ sale }) {
  const wallet = useWallet();
  const owner = wallet.publicKey?.toBase58();
  const [code, setCode] = useState(readPairCode);
  const [licenses, setLicenses] = useState({ loading: false, items: [] });
  const [status, setStatus] = useState('idle'); // idle | signing | done
  const [error, setError] = useState('');
  const [device, setDevice] = useState('');

  useEffect(() => {
    const on = () => setCode(readPairCode());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    if (!owner || !sale.collection) return;
    let alive = true;
    setLicenses({ loading: true, items: [] });
    getMyLicenses(owner, sale.collection)
      .then((items) => alive && setLicenses({ loading: false, items }))
      .catch(() => alive && setLicenses({ loading: false, items: [] }));
    return () => {
      alive = false;
    };
  }, [owner, sale.collection]);

  async function pair() {
    setError('');
    setStatus('signing');
    try {
      const res = await approvePairing(wallet, code, licenses.items.map((l) => l.address));
      setDevice(res.device || 'your computer');
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('idle');
    }
  }

  const validCode = CODE_RE.test(code);

  if (status === 'done') {
    return (
      <div className="stack">
        <section className="card center success">
          <div className="orb on" aria-hidden="true">
            <Leaf size={48} />
          </div>
          <h1 className="h-md">Paired</h1>
          <p className="muted">
            {device} is now running your {licenses.items.length === 1 ? 'Grower Node' : `${licenses.items.length} Grower Nodes`}.
            You can close this page. The desktop app shows Online in a few seconds.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="hero compact">
        <span className="eyebrow">Desktop node</span>
        <h1 className="h-md">Pair a computer</h1>
        <p className="muted">Lets the Sprout Node app on your computer run your nodes all day, without this page open.</p>
      </section>

      <section className="card center">
        <span className="label">Code on your computer</span>
        {validCode ? (
          <strong className="pair-code num">{code}</strong>
        ) : (
          <p className="muted">
            Open the Sprout Node app on your computer and scan its QR code with this phone, or open the link it shows.
          </p>
        )}
        <p className="muted small">Make sure this matches the code on your computer screen.</p>
      </section>

      {!owner ? (
        <section className="card center">
          <p className="muted">Connect the wallet that holds your Grower Node licenses.</p>
          <WalletMultiButton />
        </section>
      ) : licenses.loading ? (
        <p className="hint">Checking your licenses…</p>
      ) : !licenses.items.length ? (
        <section className="card center">
          <p className="muted">This wallet has no Grower Node license yet.</p>
          <a className="btn primary" href="#/buy">
            Get a license
          </a>
        </section>
      ) : (
        <>
          <button type="button" className="btn primary" disabled={!validCode || status === 'signing'} onClick={pair}>
            {status === 'signing' ? 'Check your wallet…' : `Pair and run ${licenses.items.length === 1 ? 'my node' : `my ${licenses.items.length} nodes`}`}
          </button>
          <p className="hint">You'll sign a free message. It can't move your funds.</p>
        </>
      )}

      {error && (
        <p className="alert bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
