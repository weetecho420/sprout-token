// The node itself: pairing, then one small heartbeat a minute. No Electron UI code here,
// so it can be tested on its own.
const crypto = require('crypto');
const { EventEmitter } = require('events');
const QRCode = require('qrcode');
const config = require('./config');

const PHANTOM_BROWSE = (url) =>
  `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(config.APP_URL).origin)}`;

class NodeRunner extends EventEmitter {
  /**
   * @param {object} deps
   * @param {object} deps.api   pairStart, pairCheck, heartbeat, pause, unpair
   * @param {object} deps.store load, save, clear
   * @param {string} deps.deviceName
   */
  constructor({ api, store, deviceName }) {
    super();
    this.api = api;
    this.store = store;
    this.deviceName = deviceName;
    this.timer = null;
    this.pairTimer = null;
    const saved = store.load();
    this.token = saved.token;
    this.state = {
      phase: saved.token ? (saved.paused ? 'paused' : 'starting') : 'unpaired',
      owner: saved.owner,
      nodes: [],
      lastBeatAt: null,
      sessionStartedAt: null,
      message: '',
      pairing: null, // { code, link, qr, expiresAt }
    };
  }

  get snapshot() {
    return { ...this.state, network: config.NETWORK, stages: config.STAGES };
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('change', this.snapshot);
  }

  start() {
    if (this.token && this.state.phase !== 'paused') this.resume();
    else this.emit('change', this.snapshot);
  }

  // ---------- pairing ----------
  async beginPairing() {
    this.cancelPairing();
    this.set({ phase: 'pairing', message: '', pairing: null });
    const secret = crypto.randomBytes(32).toString('hex');
    let res;
    try {
      res = await this.api.pairStart(secret, this.deviceName);
    } catch (e) {
      this.set({ phase: 'unpaired', message: e.message });
      return;
    }
    const pageUrl = `${config.APP_URL}#/pair?code=${res.code}`;
    const link = PHANTOM_BROWSE(pageUrl);
    const qr = await QRCode.toDataURL(link, { margin: 1, width: 280, color: { dark: '#0c100c', light: '#ffffff' } });
    this.set({ pairing: { code: res.code, link, pageUrl, qr, expiresAt: Date.parse(res.expiresAt) } });

    const poll = async () => {
      if (this.state.phase !== 'pairing') return;
      try {
        const r = await this.api.pairCheck(res.code, secret);
        if (r.status === 'paired') {
          this.token = r.token;
          this.store.save({ token: r.token, owner: r.owner, paused: false });
          this.set({ owner: r.owner, pairing: null, message: '' });
          this.emit('paired');
          this.resume();
          return;
        }
      } catch (e) {
        if (e.status === 410 || e.status === 404) {
          this.set({ phase: 'unpaired', pairing: null, message: 'The code expired. Start pairing again.' });
          return;
        }
        // network hiccup: keep polling
      }
      this.pairTimer = setTimeout(poll, config.PAIR_POLL_MS);
    };
    this.pairTimer = setTimeout(poll, config.PAIR_POLL_MS);
  }

  cancelPairing() {
    clearTimeout(this.pairTimer);
    this.pairTimer = null;
    if (this.state.phase === 'pairing') this.set({ phase: this.token ? 'paused' : 'unpaired', pairing: null });
  }

  // ---------- running ----------
  schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.beat(), ms);
  }

  async beat() {
    if (!this.token || this.state.phase === 'paused' || this.state.phase === 'unpaired') return;
    try {
      const res = await this.api.heartbeat(this.token);
      this.set({
        phase: 'online',
        nodes: res.nodes || [],
        owner: res.owner || this.state.owner,
        lastBeatAt: Date.now(),
        message: '',
      });
      this.schedule(config.HEARTBEAT_MS);
    } catch (e) {
      if (e.status === 401) {
        // Session was removed (unpaired from elsewhere or expired)
        this.forget('This computer was unpaired. Pair it again to keep earning.');
      } else if (e.status === 403) {
        this.set({ phase: 'nolicense', message: e.message });
        this.schedule(5 * 60 * 1000);
      } else {
        this.set({ phase: 'reconnecting', message: e.message });
        this.schedule(config.RETRY_MS);
      }
    }
  }

  resume() {
    if (!this.token) return;
    this.store.save({ token: this.token, owner: this.state.owner, paused: false });
    this.set({ phase: 'starting', sessionStartedAt: Date.now(), message: '' });
    this.beat();
  }

  async pause() {
    clearTimeout(this.timer);
    this.store.save({ token: this.token, owner: this.state.owner, paused: true });
    this.set({ phase: 'paused', sessionStartedAt: null });
    try {
      const res = await this.api.pause(this.token);
      if (res.nodes?.length) this.set({ nodes: res.nodes });
    } catch {
      /* goes offline by itself after 3 minutes */
    }
  }

  /** After waking from sleep or coming back online, check in straight away. */
  wake() {
    if (this.token && ['online', 'reconnecting', 'starting'].includes(this.state.phase)) this.beat();
  }

  async unpair() {
    clearTimeout(this.timer);
    const t = this.token;
    this.forget('');
    if (t) {
      try {
        await this.api.unpair(t);
      } catch {
        /* the session will expire on its own */
      }
    }
  }

  forget(message) {
    clearTimeout(this.timer);
    this.token = null;
    this.store.clear();
    this.set({ phase: 'unpaired', owner: null, nodes: [], lastBeatAt: null, sessionStartedAt: null, message });
  }

  /** Called when the app quits: credit the last stretch and mark offline (best effort). */
  async shutdown() {
    clearTimeout(this.timer);
    clearTimeout(this.pairTimer);
    if (this.token && this.state.phase === 'online') {
      try {
        await Promise.race([this.api.pause(this.token), new Promise((r) => setTimeout(r, 1500))]);
      } catch {
        /* fine */
      }
    }
  }
}

module.exports = { NodeRunner, PHANTOM_BROWSE };
