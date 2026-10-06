import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getMyLicenses } from './solana';
import {
  loadLoungeSession,
  saveLoungeSession,
  loungeLogin,
  loungeList,
  loungeSend,
  loungeReport,
  loungeDelete,
  loungeBan,
} from './node';
import { TIERS } from './tiers';

const POLL_MS = 4000;
const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;

function timeLabel(iso) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function LoungePage({ sale }) {
  const wallet = useWallet();
  const owner = wallet.publicKey?.toBase58();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null); // message whose actions are showing
  const [reported, setReported] = useState({});
  const listRef = useRef(null);
  const atBottom = useRef(true);

  useEffect(() => {
    setSession(owner ? loadLoungeSession(owner) : null);
    setMessages([]);
    setError('');
  }, [owner]);

  const signOut = useCallback((msg) => {
    saveLoungeSession(null);
    setSession(null);
    if (msg) setError(msg);
  }, []);

  const apply = useCallback((res) => {
    setMessages(res.messages || []);
    setAdmin(!!res.admin);
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      apply(await loungeList(session.token));
    } catch (e) {
      if (e.status === 401 || e.status === 403) signOut(e.status === 403 ? e.message : '');
    }
  }, [session, apply, signOut]);

  // Poll while the page is visible
  useEffect(() => {
    if (!session) return;
    refresh();
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [session, refresh]);

  // Keep the newest message in view unless the reader has scrolled up
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function enter() {
    setError('');
    setBusy('enter');
    try {
      const licenses = sale.collection ? await getMyLicenses(owner, sale.collection) : [];
      if (!licenses.length) throw new Error('The Lounge is for Grower Node holders. Get a license first.');
      setSession(await loungeLogin(wallet, licenses.map((l) => l.address)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy('send');
    setError('');
    try {
      atBottom.current = true;
      apply(await loungeSend(session.token, body));
      setText('');
    } catch (err) {
      if (err.status === 401) signOut('Please enter the Lounge again.');
      else setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function act(kind, m) {
    setOpenId(null);
    try {
      if (kind === 'report') {
        await loungeReport(session.token, m.id);
        setReported((r) => ({ ...r, [m.id]: true }));
      } else if (kind === 'delete') {
        apply(await loungeDelete(session.token, m.id));
      } else if (kind === 'ban') {
        if (!confirm(`Ban ${short(m.owner)} from the Lounge? Their messages will be hidden.`)) return;
        apply(await loungeBan(session.token, m.owner));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // ---- screens ----
  const rules = (
    <section className="card lounge-rules">
      <strong>🛡️ Stay safe</strong>
      <ul>
        <li>The Sprout team will <b>never</b> DM you or ask for your recovery phrase.</li>
        <li>Official messages have a green <b>Sprout team</b> badge. Anything else claiming to be us is fake.</li>
        <li>Links are blocked. Report anything suspicious with ⋯.</li>
      </ul>
    </section>
  );

  if (!owner) {
    return (
      <div className="stack">
        <section className="hero compact">
          <span className="eyebrow">Holders only</span>
          <h1 className="h-md">Growers Lounge</h1>
          <p className="muted">Chat with other Grower Node holders.</p>
        </section>
        <section className="card center">
          <p className="muted">Connect the wallet that holds your Grower Node license.</p>
          <WalletMultiButton />
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="hero compact">
          <span className="eyebrow">Holders only</span>
          <h1 className="h-md">Growers Lounge</h1>
          <p className="muted">Chat with other Grower Node holders. Your name shows as your wallet, in your best license color.</p>
        </section>
        {rules}
        <button type="button" className="btn primary" onClick={enter} disabled={busy === 'enter'}>
          {busy === 'enter' ? 'Check your wallet…' : 'Enter the Lounge'}
        </button>
        <p className="hint">You'll sign a free message. It can't move your funds.</p>
        {error && (
          <p className="alert bad" role="alert">
            {error}{' '}
            {/license/i.test(error) && (
              <a href="#/buy" className="link">
                Get a license
              </a>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="lounge">
      <div className="lounge-head">
        <div>
          <h1 className="h-sm">Growers Lounge</h1>
          <span className="muted small">
            You're {short(owner)}
            {admin ? ' · Sprout team' : ''}
          </span>
        </div>
        <button type="button" className="btn text small" onClick={() => signOut('')}>
          Leave
        </button>
      </div>

      <div
        className="lounge-list"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        aria-live="polite"
      >
        {rules}
        {!messages.length && <p className="hint">No messages yet. Say hi 👋</p>}
        {messages.map((m) => {
          const tier = TIERS[m.tier - 1];
          const color = m.official ? 'var(--lime)' : tier?.color || 'var(--muted)';
          const canDelete = m.mine || admin;
          return (
            <article key={m.id} className={`msg ${m.mine ? 'mine' : ''} ${m.official ? 'official' : ''}`}>
              <header>
                <span className="who" style={{ color }}>
                  {m.official ? m.label || 'Sprout team' : short(m.owner)}
                </span>
                {m.official && <span className="badge">✓ Sprout team</span>}
                {!m.official && tier && <span className="tier-dot" style={{ background: tier.color }} title={tier.name} />}
                <time className="muted small" dateTime={m.at}>
                  {timeLabel(m.at)}
                </time>
                <button
                  type="button"
                  className="more"
                  aria-label="Message actions"
                  onClick={(e) => {
                    const card = e.currentTarget.closest('article');
                    setOpenId(openId === m.id ? null : m.id);
                    setTimeout(() => card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
                  }}
                >
                  ⋯
                </button>
              </header>
              <p>{m.body}</p>
              {openId === m.id && (
                <div className="msg-actions">
                  {!m.mine && !m.official && (
                    <button type="button" onClick={() => act('report', m)} disabled={reported[m.id]}>
                      {reported[m.id] ? 'Reported' : 'Report'}
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" onClick={() => act('delete', m)}>
                      Delete
                    </button>
                  )}
                  {admin && !m.mine && !m.official && (
                    <button type="button" className="danger" onClick={() => act('ban', m)}>
                      Ban wallet
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {error && (
        <p className="alert bad lounge-error" role="alert">
          {error}
        </p>
      )}
      <form className="composer" onSubmit={send}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
          placeholder="Message the Growers…"
          rows={1}
          aria-label="Message"
        />
        <button type="submit" className="btn primary" disabled={!text.trim() || busy === 'send'}>
          Send
        </button>
      </form>
    </div>
  );
}
