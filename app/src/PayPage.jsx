import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import QRCode from 'qrcode';
import { CONFIG, explorerUrl } from './config';
import {
  CURRENCIES,
  payToken,
  isWallet,
  tokenPrice,
  tokenAmount,
  newReference,
  payLink,
  findPayment,
  loadShop,
  saveShop,
  loadHistory,
  addHistory,
} from './pay';

const POLL_MS = 2000;
const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const fmtToken = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 });

function money(value, currency) {
  const c = CURRENCIES[currency];
  return `${c.sign}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function useQr(text, size = 320) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    if (!text) return setSrc('');
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0c100c', light: '#ffffff' } })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(''));
    return () => {
      live = false;
    };
  }, [text, size]);
  return src;
}

/** Live price of one token in the shop's currency, refreshed every minute. */
function usePrice(token, currency) {
  const [state, setState] = useState({ price: null, error: false });
  useEffect(() => {
    if (!currency) return;
    let live = true;
    const load = () =>
      tokenPrice(token, currency)
        .then((price) => live && setState({ price, error: false }))
        .catch(() => live && setState((s) => ({ price: s.price, error: !s.price })));
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [token.mint, token.symbol, currency]);
  return state;
}

// ---------------- setup ----------------
function Setup({ initial, onSave, onCancel }) {
  const wallet = useWallet();
  const [name, setName] = useState(initial?.name || '');
  const [to, setTo] = useState(initial?.to || '');
  const [currency, setCurrency] = useState(initial?.currency || 'PHP');
  const valid = name.trim() && isWallet(to);

  return (
    <div className="stack">
      <section className="hero compact">
        <span className="eyebrow">For shops</span>
        <h1 className="h-md">Pay with Sprout</h1>
        <p className="muted">Show a QR at your counter. Customers scan it with Phantom and pay in seconds.</p>
      </section>
      <form
        className="card pay-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave({ name: name.trim(), to: to.trim(), currency });
        }}
      >
        <label>
          <span>Shop name</span>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="e.g. XERA SUNNYDAY Store" required />
        </label>
        <label>
          <span>Wallet that receives payments</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="Your Phantom address"
            spellCheck="false"
            autoCapitalize="off"
            autoCorrect="off"
            className="mono"
          />
        </label>
        {wallet.publicKey && to !== wallet.publicKey.toBase58() && (
          <button type="button" className="btn text" onClick={() => setTo(wallet.publicKey.toBase58())}>
            Use my connected wallet ({short(wallet.publicKey.toBase58())})
          </button>
        )}
        {to && !isWallet(to) && <p className="alert bad">That doesn't look like a Solana wallet address.</p>}
        <label>
          <span>Prices in</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <option key={code} value={code}>
                {c.sign} {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn primary" disabled={!valid}>
          Save shop
        </button>
        {onCancel && (
          <button type="button" className="btn text" onClick={onCancel}>
            Cancel
          </button>
        )}
      </form>
      <p className="hint">Saved on this device only. The page never asks for your recovery phrase and can't move your funds.</p>
    </div>
  );
}

// ---------------- keypad ----------------
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

function Keypad({ value, onChange }) {
  function press(k) {
    if (k === '⌫') return onChange(value.slice(0, -1));
    if (k === '.' && value.includes('.')) return;
    if (value.includes('.') && value.split('.')[1].length >= 2) return;
    if (value.replace('.', '').length >= 7) return;
    if (value === '0' && k !== '.') return onChange(k);
    onChange((value || (k === '.' ? '0' : '')) + k);
  }
  return (
    <div className="keypad">
      {KEYS.map((k) => (
        <button key={k} type="button" onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete' : k}>
          {k}
        </button>
      ))}
    </div>
  );
}

// ---------------- counter sign (print) ----------------
function CounterSign({ shop, token, onClose }) {
  const link = payLink({ to: shop.to, token, label: shop.name });
  const qr = useQr(link, 640);
  return (
    <div className="stack">
      <div className="sign" id="counter-sign">
        <div className="sign-brand">🌱 Pay with {token.test ? 'Sprout (test)' : '$SPROUT'}</div>
        <h2>{shop.name}</h2>
        {qr && <img src={qr} alt="Payment QR code" />}
        <ol>
          <li>Open Phantom and tap Scan</li>
          <li>Type the amount you were told</li>
          <li>Show the cashier your "Sent ✓" screen</li>
        </ol>
        <p className="sign-addr">{short(shop.to)}</p>
      </div>
      <p className="hint">
        This sign has no amount, so customers type it themselves. For automatic "Paid ✓" checks, use the counter screen instead.
      </p>
      <button type="button" className="btn primary" onClick={() => window.print()}>
        Print sign
      </button>
      <button type="button" className="btn text" onClick={onClose}>
        Back
      </button>
    </div>
  );
}

// ---------------- page ----------------
export default function PayPage() {
  const token = useMemo(payToken, []);
  const [shop, setShop] = useState(loadShop);
  const [view, setView] = useState(shop ? 'charge' : 'setup');
  const [input, setInput] = useState('');
  const [sale, setSale] = useState(null); // { fiat, amount, reference, link, startedAt }
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState('');
  const [history, setHistory] = useState(loadHistory);
  const { price, error: priceError } = usePrice(token, shop?.currency);

  const fiat = Number(input || 0);
  const tokens = price ? tokenAmount(fiat / price, token) : '';
  const qr = useQr(sale?.link || '');

  function startSale() {
    if (!(fiat > 0) || !price) return;
    const reference = newReference();
    const amount = tokenAmount(fiat / price, token);
    const link = payLink({
      to: shop.to,
      amount,
      token,
      reference,
      label: shop.name,
      message: `${money(fiat, shop.currency)} at ${shop.name}`,
    });
    setProblem('');
    setResult(null);
    setSale({ fiat, amount, reference, link, startedAt: Date.now() });
    setView('qr');
  }

  const finish = useCallback(
    (res) => {
      setResult(res);
      setHistory(addHistory({ at: Date.now(), fiat: sale.fiat, currency: shop.currency, amount: sale.amount, symbol: token.symbol, signature: res.signature }));
      setView('paid');
      try {
        navigator.vibrate?.([80, 60, 80]);
      } catch {
        /* no vibration */
      }
    },
    [sale, shop, token.symbol]
  );

  // Watch the chain while the QR is showing
  const busy = useRef(false);
  useEffect(() => {
    if (view !== 'qr' || !sale) return;
    let live = true;
    const check = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await findPayment({ reference: sale.reference, to: shop.to, amount: sale.amount, token });
        if (!live || !res) return;
        if (res.ok) finish(res);
        else
          setProblem(
            `A payment arrived but it was short: got ${fmtToken(res.received)} ${token.symbol}, needed ${fmtToken(sale.amount)}. Check with the customer before handing over the goods.`
          );
      } catch {
        /* network blip: try again next tick */
      } finally {
        busy.current = false;
      }
    };
    check();
    const t = setInterval(check, POLL_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [view, sale, shop, token, finish]);

  function newSale() {
    setInput('');
    setSale(null);
    setResult(null);
    setProblem('');
    setView('charge');
  }

  if (view === 'setup' || !shop) {
    return (
      <Setup
        initial={shop}
        onCancel={shop ? () => setView('charge') : null}
        onSave={(s) => {
          saveShop(s);
          setShop(s);
          setView('charge');
        }}
      />
    );
  }

  if (view === 'sign') return <CounterSign shop={shop} token={token} onClose={() => setView('charge')} />;

  const testNote = token.test && (
    <p className="alert pay-test">
      Test mode: $SPROUT isn't live yet, so customers pay with {CONFIG.isDevnet ? 'free devnet test SOL' : 'SOL'}.
    </p>
  );

  if (view === 'qr' && sale) {
    return (
      <div className="stack pay">
        <div className="pay-total">
          <span className="muted small">{shop.name}</span>
          <strong className="num">{money(sale.fiat, shop.currency)}</strong>
          <span className="num">
            {fmtToken(sale.amount)} {token.symbol}
          </span>
        </div>
        <div className="pay-qr">{qr ? <img src={qr} alt="Scan to pay with Phantom" /> : <div className="pay-qr-blank" />}</div>
        <p className="pay-wait" role="status">
          <span className="dot" /> Waiting for payment…
        </p>
        <p className="hint">Customer: open Phantom, tap Scan, and approve.</p>
        {problem && (
          <p className="alert bad" role="alert">
            {problem}
          </p>
        )}
        {testNote}
        <button type="button" className="btn text" onClick={newSale}>
          Cancel
        </button>
      </div>
    );
  }

  if (view === 'paid' && result) {
    return (
      <div className="stack pay">
        <div className="pay-done" role="status">
          <div className="pay-check">✓</div>
          <h1 className="h-md">Paid</h1>
          <strong className="num">{money(sale.fiat, shop.currency)}</strong>
          <span className="muted num">
            {fmtToken(result.received)} {token.symbol} received
          </span>
          <a className="link small" href={explorerUrl('tx', result.signature)} target="_blank" rel="noreferrer">
            View on Solscan
          </a>
        </div>
        <button type="button" className="btn primary" onClick={newSale}>
          New sale
        </button>
      </div>
    );
  }

  // charge
  return (
    <div className="stack pay">
      <div className="pay-head">
        <div>
          <strong>{shop.name}</strong>
          <span className="muted small"> · to {short(shop.to)}</span>
        </div>
        <div className="pay-head-actions">
          <button type="button" className="btn text small" onClick={() => setView('sign')}>
            Counter sign
          </button>
          <button type="button" className="btn text small" onClick={() => setView('setup')}>
            Settings
          </button>
        </div>
      </div>

      <div className="pay-amount" aria-live="polite">
        <strong className="num">{money(input || 0, shop.currency)}</strong>
        <span className="muted num">
          {priceError
            ? "Can't load the price right now"
            : !price
              ? 'Loading price…'
              : fiat > 0
                ? `≈ ${fmtToken(tokens)} ${token.symbol}`
                : `1 ${token.symbol} ≈ ${money(price, shop.currency)}`}
        </span>
      </div>

      <Keypad value={input} onChange={setInput} />

      <button type="button" className="btn primary" onClick={startSale} disabled={!(fiat > 0) || !price}>
        Show QR
      </button>
      {testNote}

      {history.length > 0 && (
        <section className="card pay-history">
          <strong>Recent payments</strong>
          <ul>
            {history.slice(0, 8).map((h) => (
              <li key={h.signature}>
                <span className="num">{money(h.fiat, h.currency)}</span>
                <span className="muted num small">
                  {fmtToken(h.amount)} {h.symbol}
                </span>
                <a href={explorerUrl('tx', h.signature)} target="_blank" rel="noreferrer" className="small">
                  {new Date(h.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
