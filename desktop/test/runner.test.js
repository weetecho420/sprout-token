// Run: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const config = require('../src/config');
const { NodeRunner } = require('../src/runner');

config.PAIR_POLL_MS = 5;
config.HEARTBEAT_MS = 20;
config.RETRY_MS = 10;

function memStore(initial = {}) {
  let data = { token: null, owner: null, paused: false, ...initial };
  return { load: () => ({ ...data }), save: (d) => (data = { ...d }), clear: () => (data = { token: null, owner: null, paused: false }), get: () => data };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Polls until `fn()` is true (CI machines can be slow), fails after 3s
async function until(fn, what) {
  const end = Date.now() + 3000;
  while (!fn()) {
    if (Date.now() > end) assert.fail(`timed out waiting for ${what}`);
    await wait(5);
  }
}
const err = (status, message = 'x') => Object.assign(new Error(message), { status, retry: !status || status >= 500 });

test('pairs, then checks in and shows nodes', async () => {
  let checks = 0;
  const calls = [];
  const api = {
    pairStart: async (secret, device) => (calls.push(['start', secret.length, device]), { code: 'ABCD-EFGH', expiresAt: new Date(Date.now() + 6e5).toISOString() }),
    pairCheck: async () => (++checks < 3 ? { status: 'pending' } : { status: 'paired', token: 'tok-1', owner: 'W1' }),
    heartbeat: async (t) => (calls.push(['beat', t]), { owner: 'W1', nodes: [{ asset: 'a', name: 'Grower Node Seedling #1', earned: 1.5, uptimeSeconds: 60 }] }),
    pause: async () => ({ nodes: [] }),
    unpair: async () => ({ ok: true }),
  };
  const store = memStore();
  const r = new NodeRunner({ api, store, deviceName: 'Test PC' });
  assert.equal(r.snapshot.phase, 'unpaired');
  await r.beginPairing();
  assert.equal(r.snapshot.phase, 'pairing');
  assert.equal(r.snapshot.pairing.code, 'ABCD-EFGH');
  assert.match(r.snapshot.pairing.link, /^https:\/\/phantom\.app\/ul\/browse\//);
  assert.match(decodeURIComponent(r.snapshot.pairing.link), /#\/pair\?code=ABCD-EFGH/);
  assert.match(r.snapshot.pairing.qr, /^data:image\/png;base64,/);
  await until(() => r.snapshot.phase === 'online', 'online');
  assert.equal(store.get().token, 'tok-1');
  assert.equal(r.snapshot.nodes.length, 1);
  assert.deepEqual(calls[0], ['start', 64, 'Test PC']);
  await until(() => calls.filter((c) => c[0] === 'beat').length >= 2, 'a second heartbeat');
  await r.shutdown();
});

test('network trouble shows reconnecting and recovers', async () => {
  let n = 0;
  const api = { heartbeat: async () => (++n === 1 ? Promise.reject(err(undefined, 'offline')) : { nodes: [] }), pause: async () => ({}) };
  const r = new NodeRunner({ api, store: memStore({ token: 't' }), deviceName: 'x' });
  const seen = [];
  r.on('change', (s) => seen.push(s.phase));
  r.start();
  await until(() => r.snapshot.phase === 'online', 'online after retry');
  assert.ok(seen.includes('reconnecting'), 'showed reconnecting first');
  await r.shutdown();
});

test('a removed session unpairs the computer', async () => {
  const store = memStore({ token: 't', owner: 'W' });
  const api = { heartbeat: async () => Promise.reject(err(401, 'ended')) };
  const r = new NodeRunner({ api, store, deviceName: 'x' });
  r.start();
  await until(() => r.snapshot.phase === 'unpaired', 'unpaired');
  assert.equal(store.get().token, null);
});

test('pause stops check-ins and survives a restart', async () => {
  let beats = 0;
  const store = memStore({ token: 't' });
  const api = { heartbeat: async () => (beats++, { nodes: [] }), pause: async () => ({ nodes: [] }) };
  const r = new NodeRunner({ api, store, deviceName: 'x' });
  r.start();
  await until(() => r.snapshot.phase === 'online', 'online');
  await r.pause();
  const b = beats;
  await wait(60);
  assert.equal(beats, b, 'no beats while paused');
  assert.equal(store.get().paused, true);
  const r2 = new NodeRunner({ api, store, deviceName: 'x' });
  r2.start();
  assert.equal(r2.snapshot.phase, 'paused');
  r2.resume();
  await until(() => r2.snapshot.phase === 'online', 'online after resume');
  await r2.shutdown();
});

test('expired pairing code goes back to start', async () => {
  const api = {
    pairStart: async () => ({ code: 'AAAA-BBBB', expiresAt: new Date().toISOString() }),
    pairCheck: async () => Promise.reject(err(410, 'expired')),
  };
  const r = new NodeRunner({ api, store: memStore(), deviceName: 'x' });
  await r.beginPairing();
  await until(() => r.snapshot.phase === 'unpaired', 'back to unpaired');
  assert.match(r.snapshot.message, /expired/);
});
