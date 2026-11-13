import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { joinWaitlist, waitlistStatus } from './node';
import { fmt } from './format';

const hours = (s) => Math.floor((s || 0) / 3600);

export default function EarlyPage() {
  const wallet = useWallet();
  const owner = wallet.publicKey?.toBase58();
  const [status, setStatus] = useState(null);
  const [x, setX] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    waitlistStatus(owner)
      .then(setStatus)
      .catch(() => {});
  }, [owner]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function join(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      setStatus(await joinWaitlist(wallet, x.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const need = status?.earlySeconds || 86400;
  const up = status?.uptimeSeconds || 0;
  const pct = Math.min(100, (up / need) * 100);

  return (
    <div className="stack">
      <section className="hero">
        <span className="eyebrow">Free · No payment</span>
        <h1>Join the Grower list</h1>
        <p>
          The real Grower Node sale opens after $SPROUT launches. Join the list now for free, and run a beta node to earn
          the Early Grower badge.
        </p>
      </section>

      {status && (
        <section className="card early-stats" aria-live="polite">
          <div>
            <strong className="num">{fmt(status.total)}</strong>
            <span className="label">on the list</span>
          </div>
          <div>
            <strong className="num">{fmt(status.earlyTotal)}</strong>
            <span className="label">Early Growers</span>
          </div>
        </section>
      )}

      {status?.early && (
        <section className="card early-badge" role="status">
          <div className="early-medal" aria-hidden="true">🌱</div>
          <div>
            <strong>You're an Early Grower</strong>
            <p className="muted small">You're on the list and ran a beta node for 24 hours. Thanks for growing with us from day one.</p>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="h-sm">How to get the badge</h2>
        <ol className="early-steps">
          <li className={status?.joined ? 'done' : ''}>
            <span className="tick" aria-hidden="true">{status?.joined ? '✓' : '1'}</span>
            <div>
              <b>Join the list</b>
              <p className="muted small">Sign a free message with your wallet. It can't move your funds.</p>
            </div>
          </li>
          <li className={up >= need ? 'done' : ''}>
            <span className="tick" aria-hidden="true">{up >= need ? '✓' : '2'}</span>
            <div>
              <b>Run a beta node for 24 hours</b>
              <p className="muted small">
                Get a free beta node with test SOL and keep it online. Hours add up, they don't need to be in a row.
              </p>
              {owner && (
                <>
                  <div className="bar early-bar" aria-hidden="true">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <span className="muted small num">
                    {Math.min(hours(up), hours(need))} / {hours(need)} hours
                  </span>
                </>
              )}
              {up < need && (
                <a className="link small" href="/beta/">
                  How to join the free beta
                </a>
              )}
            </div>
          </li>
        </ol>
      </section>

      {!owner ? (
        <section className="card center">
          <p className="muted">Connect your Solana wallet to join the list.</p>
          <WalletMultiButton />
        </section>
      ) : status?.joined ? (
        <p className="alert good" role="status">
          ✓ This wallet is on the list. We'll announce the sale date on X first.
        </p>
      ) : (
        <form className="card early-form" onSubmit={join}>
          <label>
            <span>Your X handle (optional)</span>
            <input
              value={x}
              onChange={(e) => setX(e.target.value.slice(0, 16))}
              placeholder="@yourname"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Check your wallet…' : 'Join the list (free)'}
          </button>
          {error && (
            <p className="alert bad" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      <section className="card">
        <h2 className="h-sm">Good to know</h2>
        <ul className="early-facts">
          <li>Joining is free. You never pay to be on the list.</li>
          <li>The real sale opens after $SPROUT launches on 27 January 2027. We'll post the date on @Sproutbeginning.</li>
          <li>Early Growers get first access when the sale opens.</li>
          <li>Beta nodes use test SOL. Beta rewards are for testing only and aren't real $SPROUT.</li>
          <li>We will never DM you first or ask for your recovery phrase.</li>
        </ul>
      </section>
    </div>
  );
}
