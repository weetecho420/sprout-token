// Talks to the Sprout Node backend (Supabase): sign in, heartbeats, stop, and public status.
import bs58 from 'bs58';
import { CONFIG } from './config';

export const HEARTBEAT_MS = 60 * 1000;
export const OFFLINE_AFTER_MS = 180 * 1000; // matches the server's gap

const headers = () => ({
  'Content-Type': 'application/json',
  apikey: CONFIG.supabaseKey,
});

export const nodeNetworkReady = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);

async function call(action, body) {
  let res;
  try {
    res = await fetch(`${CONFIG.supabaseUrl}/functions/v1/sprout-node`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    const err = new Error("Can't reach the node network. Check your internet connection.");
    err.retry = true;
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || 'The node network had a problem.');
    err.status = res.status;
    err.retry = res.status >= 500;
    throw err;
  }
  return json;
}

/** Asks the wallet to sign a free sign-in message, then starts a node session. */
export async function startNode(wallet, assets) {
  if (!wallet.signMessage) throw new Error("This wallet can't sign messages. Try Phantom or Solflare.");
  const owner = wallet.publicKey.toBase58();
  const message =
    `Sprout Node sign-in\n\nWallet: ${owner}\nTime: ${new Date().toISOString()}\n\n` +
    "This only proves you own this wallet. It's free and can't move your funds.";
  let sig;
  try {
    sig = await wallet.signMessage(new TextEncoder().encode(message));
  } catch {
    throw new Error('You cancelled the sign-in in your wallet. Nothing happened.');
  }
  return call('login', { owner, message, signature: bs58.encode(sig), assets });
}

export const heartbeat = (token) => call('heartbeat', { token });
export const stopNode = (token) => call('stop', { token });

/** Public status for every node a wallet runs. */
export async function getNodeStatus(owner) {
  if (!nodeNetworkReady()) return [];
  const url = `${CONFIG.supabaseUrl}/rest/v1/sprout_nodes?owner=eq.${encodeURIComponent(owner)}&select=asset,name,uptime_seconds,earned,last_seen`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error('Could not load node status');
  return (await res.json()).map((n) => ({
    asset: n.asset,
    name: n.name,
    uptimeSeconds: Number(n.uptime_seconds),
    earned: Number(n.earned),
    lastSeen: n.last_seen,
  }));
}

export const isOnline = (n, now = Date.now()) => !!n?.lastSeen && now - Date.parse(n.lastSeen) < OFFLINE_AFTER_MS;

/** Seed → Hero stage for a node, from its total online time. */
export function stageFor(uptimeSeconds = 0) {
  const days = uptimeSeconds / 86400;
  const stages = CONFIG.stages;
  let i = 0;
  while (i + 1 < stages.length && days >= stages[i + 1].afterDays) i++;
  const cur = stages[i];
  const next = stages[i + 1] || null;
  const progress = next ? (days - cur.afterDays) / (next.afterDays - cur.afterDays) : 1;
  return { ...cur, index: i, next, progress: Math.max(0, Math.min(1, progress)) };
}
