import { CONFIG } from './config';
import { countdown, formatDate, fmt, solText, minPerDay, maxPerDay } from './format';
import { TIERS, ORDINALS } from './tiers';

export default function SalePage({ sale, now }) {
  const left = sale.startsAt ? countdown(sale.startsAt - now) : null;
  const pct = sale.total ? Math.min(100, (sale.sold / sale.total) * 100) : 0;
  const showTiers = sale.tiered || !sale.configured;

  return (
    <div className="stack">
      <section className="hero">
        <span className="eyebrow">Seed → Hero</span>
        <h1>Grow the Sprout Network</h1>
        <p>
          Run a Grower Node that stores and serves files for the Sprout network, and earn $SPROUT every day it stays
          online.
        </p>
      </section>

      {sale.error && <p className="alert bad">{sale.error}</p>}
      {!sale.configured && !sale.loading && !sale.error && (
        <p className="alert">The sale isn't set up yet. The details below are the planned sale.</p>
      )}

      <section className="card license">
        <div className="lic-top">
          <img
            src={showTiers ? TIERS[0].image : `${import.meta.env.BASE_URL}grower-node-license.png`}
            alt="Grower Node License NFT artwork"
            width="88"
            height="88"
          />
          <div>
            <h2>Grower Node License</h2>
            <p className="muted">{showTiers ? 'An NFT in your wallet · 5 colors' : 'An NFT in your wallet · Solana'}</p>
          </div>
        </div>

        <div className="grid2">
          <div className="stat">
            <span className="label">Price</span>
            <strong>{solText(sale.priceSol)}</strong>
          </div>
          <div className="stat">
            <span className="label">Per wallet</span>
            <strong>Max {sale.maxPerWallet}</strong>
          </div>
        </div>

        <div className="sold">
          <div className="sold-row">
            <span className="label">Licenses sold</span>
            <strong className="num">
              {sale.loading ? '…' : `${fmt(sale.sold)} / ${fmt(sale.total)}`}
            </strong>
          </div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>

        {sale.soldOut ? (
          <p className="alert">All {fmt(sale.total)} licenses are sold.</p>
        ) : left ? (
          <div className="countdown" aria-live="off">
            <span className="label">Sale opens {formatDate(sale.startsAt)}</span>
            <div className="cd">
              {[
                ['days', left.d],
                ['hrs', left.h],
                ['min', left.m],
                ['sec', left.s],
              ].map(([k, v]) => (
                <div key={k}>
                  <strong className="num">{String(v).padStart(2, '0')}</strong>
                  <span>{k}</span>
                </div>
              ))}
            </div>
          </div>
        ) : sale.isLive ? (
          <p className="live">
            <span className="dot" /> Sale is open
          </p>
        ) : null}

        <a className="btn primary" href="#/buy">
          Become a Grower
        </a>
      </section>

      {showTiers && (
        <section className="card">
          <h2 className="h-sm">Collect all five colors</h2>
          <p className="muted small">
            Your first license is a Seedling. Every license you add grows into the next color, up to five. Every color earns
            the same $SPROUT.
          </p>
          <ul className="tier-grid">
            {TIERS.map((t, i) => {
              const m = sale.tiered ? sale.machines[i] : null;
              return (
                <li key={t.n} style={{ '--c': t.color }}>
                  <img src={t.image} alt={`${t.name} Grower Node`} width="200" height="200" loading="lazy" />
                  <span className="tier-ord">{ORDINALS[i]} license</span>
                  <strong>{t.name}</strong>
                  <span className="muted small num">{m ? `${fmt(m.sold)} / ${fmt(m.total)}` : `Tier ${t.roman}`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card earn">
        <span className="label">Estimated rewards per node</span>
        <div className="big">
          <strong className="num">
            {minPerDay}–{maxPerDay}
          </strong>
          <span>$SPROUT / day</span>
        </div>
        <p className="muted small">Starts at {minPerDay} a day and grows with your node. Estimates only, not guaranteed.</p>
      </section>

      <section className="card">
        <h2 className="h-sm">Your node levels up</h2>
        <ol className="ladder">
          {CONFIG.stages.map((s, i) => (
            <li key={s.name} className={i === CONFIG.stages.length - 1 ? 'top' : ''}>
              <span className="name">{s.name}</span>
              <span className="when">{s.afterDays === 0 ? 'Day 1' : `${s.afterDays} days online`}</span>
              <strong className="num">{s.perDay}/day</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2 className="h-sm">How it works</h2>
        <ol className="how">
          <li>
            <b>Get a license.</b> Pay in SOL from Phantom or Solflare. The license arrives in your wallet as an NFT.
          </li>
          <li>
            <b>Run your node.</b> Open the Sprout Node app on a device that stays online.
          </li>
          <li>
            <b>Earn and claim.</b> $SPROUT builds up every day your node is online.
          </li>
        </ol>
      </section>
    </div>
  );
}
