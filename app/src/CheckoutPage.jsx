import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { buyLicenses, friendlyError, getMintedCounts, purchasePlan } from './solana';
import { explorerUrl } from './config';
import { formatDate, fmt, solText, minPerDay } from './format';
import { tierForMachine, ORDINALS } from './tiers';
import { IconExternal } from './icons.jsx';

export default function CheckoutPage({ sale, onBought }) {
  const wallet = useWallet();
  const owner = wallet.publicKey?.toBase58();
  const [counts, setCounts] = useState([]); // licenses this wallet already bought, per sale machine
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setCounts([]);
    if (owner && sale.configured) {
      getMintedCounts(owner, sale)
        .then((c) => alive && setCounts(c))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [owner, sale.configured, sale.machines, refreshKey]);

  const bought = counts.reduce((s, n) => s + n, 0);
  const plan = sale.configured ? purchasePlan(sale, counts) : [];
  const walletLeft = plan.length;
  const max = Math.max(1, walletLeft);
  const [qty, setQty] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(null); // { i, n }
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const q = Math.min(qty, max);
  const total = q * sale.priceSol;
  const order = plan.slice(0, q);

  let blocker = '';
  if (!sale.configured) blocker = "The sale isn't set up yet.";
  else if (sale.soldOut) blocker = 'All licenses are sold.';
  else if (!sale.isLive && sale.startsAt) blocker = `The sale opens ${formatDate(sale.startsAt)}.`;
  else if (!wallet.connected) blocker = 'Connect your wallet to continue.';
  else if (walletLeft === 0)
    blocker = sale.tiered
      ? `This wallet already has every color it can get (${bought} of ${sale.maxPerWallet}).`
      : `This wallet already has the maximum of ${sale.maxPerWallet} licenses.`;
  else if (!agreed) blocker = 'Tick the box above to continue.';

  async function pay() {
    setError('');
    setDone(null);
    try {
      const minted = await buyLicenses(wallet, sale, order, (i, n) => setBusy({ i, n }));
      setDone(minted);
      onBought?.();
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setBusy(null);
      setRefreshKey((k) => k + 1);
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
            {done.map((m, i) => {
              const t = tierForMachine(sale, m.machine);
              return (
              <li key={m.address}>
                <span className="tier-chip">
                  <img src={t.image} alt="" width="40" height="40" />
                  {sale.tiered ? `${t.name} · Tier ${t.roman}` : `License ${i + 1}`}
                </span>
                <a href={explorerUrl('token', m.address)} target="_blank" rel="noopener">
                  View <IconExternal />
                </a>
              </li>
              );
            })}
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
        {owner && sale.configured && bought > 0 && !sale.tiered && (
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

      {sale.tiered && order.length > 0 && (
        <section className="card">
          <h2 className="h-sm">{order.length === 1 ? "You'll get" : `You'll get ${order.length} colors`}</h2>
          <ul className="tier-order">
            {order.map((mi) => {
              const t = tierForMachine(sale, mi);
              return (
                <li key={mi} style={{ '--c': t.color }}>
                  <img src={t.image} alt={`${t.name} Grower Node`} width="72" height="72" />
                  <div>
                    <strong>{t.name}</strong>
                    <span className="muted small">
                      Your {ORDINALS[bought + order.indexOf(mi)] || 'next'} license · Tier {t.roman}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {bought > 0 && (
            <p className="muted small">
              This wallet already has {bought} {bought === 1 ? 'color' : 'colors'}, so you start at {tierForMachine(sale, order[0]).name}.
            </p>
          )}
        </section>
      )}

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
