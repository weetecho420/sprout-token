import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { buyLicenses, friendlyError, getMintedCount } from './solana';
import { explorerUrl } from './config';
import { formatDate, fmt, solText, minPerDay } from './format';
import { IconExternal } from './icons.jsx';

export default function CheckoutPage({ sale, onBought }) {
  const wallet = useWallet();
  const owner = wallet.publicKey?.toBase58();
  const [bought, setBought] = useState(0); // licenses this wallet already has from the sale
  const [doneCount, setDoneCount] = useState(0);
  useEffect(() => {
    let alive = true;
    setBought(0);
    if (owner && sale.configured) {
      getMintedCount(owner, sale)
        .then((n) => alive && setBought(n))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [owner, sale.configured, sale.candyGuard, sale.mintLimitId, doneCount]);
  const walletLeft = Math.max(0, sale.maxPerWallet - bought);
  const max = Math.max(1, Math.min(walletLeft || 1, sale.remaining || sale.maxPerWallet));
  const [qty, setQty] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(null); // { i, n }
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const q = Math.min(qty, max);
  const total = q * sale.priceSol;

  let blocker = '';
  if (!sale.configured) blocker = "The sale isn't set up yet.";
  else if (sale.soldOut) blocker = 'All licenses are sold.';
  else if (!sale.isLive && sale.startsAt) blocker = `The sale opens ${formatDate(sale.startsAt)}.`;
  else if (!wallet.connected) blocker = 'Connect your wallet to continue.';
  else if (walletLeft === 0) blocker = `This wallet already has the maximum of ${sale.maxPerWallet} licenses.`;
  else if (!agreed) blocker = 'Tick the box above to continue.';

  async function pay() {
    setError('');
    setDone(null);
    try {
      const minted = await buyLicenses(wallet, sale, q, (i, n) => setBusy({ i, n }));
      setDone(minted);
      setDoneCount((c) => c + 1);
      onBought?.();
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="stack">
        <section className="card success">
          <h1 className="h-md">You're a Grower</h1>
          <p className="muted">
            {done.length === 1 ? 'Your license is' : `Your ${done.length} licenses are`} in your wallet now.
          </p>
          <ul className="minted">
            {done.map((m, i) => (
              <li key={m.address}>
                <span>License {i + 1}</span>
                <a href={explorerUrl('token', m.address)} target="_blank" rel="noopener">
                  View on Solscan <IconExternal />
                </a>
              </li>
            ))}
          </ul>
          <a className="btn primary" href="#/nodes">
            See My Nodes
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="hero compact">
        <h1 className="h-md">Get a Grower License</h1>
        <p className="muted">
          {solText(sale.priceSol)} per node · max {sale.maxPerWallet} per wallet
          {sale.configured ? ` · ${fmt(sale.remaining)} left` : ''}
        </p>
        {owner && sale.configured && bought > 0 && (
          <p className="muted small">
            This wallet has {bought} of {sale.maxPerWallet}
            {walletLeft > 0 ? `, so you can buy ${walletLeft} more.` : '.'}
          </p>
        )}
      </section>

      <section className="card">
        <div className="qty-row">
          <span id="qtyLabel" className="q-label">
            How many nodes?
          </span>
          <div className="stepper" role="group" aria-labelledby="qtyLabel">
            <button type="button" aria-label="Fewer nodes" onClick={() => setQty(Math.max(1, q - 1))} disabled={q <= 1 || !!busy}>
              −
            </button>
            <output className="num" aria-live="polite">
              {q}
            </output>
            <button type="button" aria-label="More nodes" onClick={() => setQty(Math.min(max, q + 1))} disabled={q >= max || !!busy}>
              +
            </button>
          </div>
        </div>
      </section>

      <section className="card earn">
        <span className="label">Estimated rewards to start</span>
        <div className="big">
          <strong className="num">{fmt(q * minPerDay)}</strong>
          <span>$SPROUT / day</span>
        </div>
        <p className="muted small">At Seed stage, rising as your nodes grow. Estimate only, not guaranteed.</p>
      </section>

      <section className="card">
        <h2 className="h-sm">Order summary</h2>
        <div className="line">
          <span>
            {q} × Grower License
          </span>
          <span className="num">{solText(total)}</span>
        </div>
        <div className="line muted">
          <span>Network fees</span>
          <span>about 0.01 SOL</span>
        </div>
        <div className="line total">
          <span>Total</span>
          <strong className="num">{solText(total)}</strong>
        </div>
      </section>

      <section className="card">
        <div className="wallet-row">
          <div>
            <span className="label">Pay with</span>
            <p className="addr">
              {wallet.publicKey ? `${wallet.publicKey.toBase58().slice(0, 4)}…${wallet.publicKey.toBase58().slice(-4)}` : 'No wallet connected'}
            </p>
          </div>
          <WalletMultiButton />
        </div>
      </section>

      <label className="agree" htmlFor="agree">
        <input id="agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I understand rewards are estimates, not guaranteed, and that $SPROUT can go up or down in value.
        </span>
      </label>

      {error && (
        <p className="alert bad" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="btn primary" disabled={!!blocker || !!busy} onClick={pay}>
        {busy ? `Approve in your wallet (${busy.i} of ${busy.n})…` : `Confirm & Pay ${solText(total)}`}
      </button>
      {blocker && !busy && <p className="hint">{blocker}</p>}
      {busy && busy.n > 1 && <p className="hint">Each license is a separate approval in your wallet.</p>}
    </div>
  );
}
