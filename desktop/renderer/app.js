// Window UI. All node logic lives in the main process (src/runner.js); this only draws it.
const $ = (id) => document.getElementById(id);
const TIERS = [
  ['Seedling', '#4BE38A'],
  ['Bloom', '#38E1D0'],
  ['Canopy', '#5AA8FF'],
  ['Grove', '#B27BFF'],
  ['Evergreen', '#FFC94D'],
];
const APP_URL = 'https://sprouttoken.netlify.app/app/';
let state = null;

const fmt2 = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function duration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${pad(m)}m`;
  return `${m}m ${pad(s % 60)}s`;
}

function stageFor(uptime, stages) {
  const days = (uptime || 0) / 86400;
  let st = stages[0];
  for (const s of stages) if (days >= s.afterDays) st = s;
  return st;
}

function tierColor(name = '') {
  const t = TIERS.find(([n]) => name.includes(n));
  return t ? t[1] : '#C6F26B';
}

function show(view) {
  for (const v of ['unpaired', 'pairing', 'running']) $(`v-${v}`).hidden = v !== view;
}

function render() {
  const s = state;
  if (!s) return;
  $('testbar').hidden = s.network !== 'devnet';

  if (s.phase === 'unpaired') {
    show('unpaired');
    $('m-unpaired').hidden = !s.message;
    $('m-unpaired').textContent = s.message || '';
    return;
  }
  if (s.phase === 'pairing') {
    show('pairing');
    if (s.pairing) {
      $('qr').src = s.pairing.qr;
      $('code').textContent = s.pairing.code;
    } else {
      $('qr').removeAttribute('src');
      $('code').textContent = '····-····';
    }
    return;
  }

  show('running');
  const on = s.phase === 'online';
  $('runner').classList.toggle('on', on);
  const label = {
    online: 'Online',
    starting: 'Starting…',
    reconnecting: 'Reconnecting…',
    paused: 'Paused',
    nolicense: 'No license found',
  }[s.phase];
  $('state').textContent = label || s.phase;
  $('state').className = `state ${on ? 'good' : ''}`;

  const perDay = s.nodes.reduce((sum, n) => sum + stageFor(n.uptimeSeconds, s.stages).perDay, 0);
  const lead = stageFor(s.nodes[0]?.uptimeSeconds, s.stages);
  $('sub').textContent = s.nodes.length
    ? `${s.nodes.length} ${s.nodes.length === 1 ? 'node' : 'nodes'} · ${lead.name} stage · ${perDay} $SPROUT/day`
    : s.owner
      ? `Wallet ${s.owner.slice(0, 4)}…${s.owner.slice(-4)}`
      : '';

  $('b-toggle').textContent = s.phase === 'paused' ? 'Resume node' : 'Pause node';
  $('b-toggle').className = `btn ${s.phase === 'paused' ? 'primary' : 'ghost'}`;
  $('m-running').hidden = !s.message;
  $('m-running').textContent = s.message || '';
  $('m-running').className = `alert ${s.phase === 'nolicense' ? 'bad' : ''}`;
  $('c-login').checked = !!s.openAtLogin;

  const list = $('nodes');
  list.replaceChildren(
    ...(s.nodes.length
      ? s.nodes.map((n) => {
          const li = document.createElement('li');
          li.style.setProperty('--c', tierColor(n.name));
          const name = document.createElement('strong');
          name.textContent = n.name || 'Grower Node';
          const meta = document.createElement('span');
          meta.className = 'muted small';
          meta.textContent = `${stageFor(n.uptimeSeconds, s.stages).name} · ${duration(n.uptimeSeconds)} online · ${fmt2(n.earned)} earned`;
          li.append(name, meta);
          return li;
        })
      : [Object.assign(document.createElement('li'), { className: 'muted small', textContent: 'Your nodes show up after the first check-in.' })])
  );
  tick();
}

// Live numbers between check-ins (only while the window is visible)
function tick() {
  const s = state;
  if (!s || $('v-running').hidden) return;
  const now = Date.now();
  const on = s.phase === 'online';
  const since = on && s.lastBeatAt ? (now - s.lastBeatAt) / 1000 : 0;
  const perDay = s.nodes.reduce((sum, n) => sum + stageFor(n.uptimeSeconds, s.stages).perDay, 0);
  const earned = s.nodes.reduce((sum, n) => sum + (n.earned || 0), 0) + (since / 86400) * perDay;
  $('earned').textContent = fmt2(earned);
  $('session').textContent = on && s.sessionStartedAt ? duration((now - s.sessionStartedAt) / 1000) : '–';
  if (s.phase === 'pairing' && s.pairing) {
    const left = Math.max(0, Math.round((s.pairing.expiresAt - now) / 1000));
    $('expires').textContent = `Code expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }
}
setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  tick();
  if (state?.phase === 'pairing' && state.pairing) {
    const left = Math.max(0, Math.round((state.pairing.expiresAt - Date.now()) / 1000));
    $('expires').textContent = `Code expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }
}, 1000);

$('b-pair').onclick = () => window.sprout.pair();
$('b-cancel').onclick = () => window.sprout.cancelPair();
$('b-copy').onclick = async () => {
  if (!state?.pairing) return;
  await navigator.clipboard.writeText(state.pairing.pageUrl);
  $('b-copy').textContent = 'Link copied. Open it in Phantom';
  setTimeout(() => ($('b-copy').textContent = 'Copy link instead'), 4000);
};
$('b-toggle').onclick = () => (state?.phase === 'paused' ? window.sprout.resume() : window.sprout.pause());
$('c-login').onchange = (e) => window.sprout.setOpenAtLogin(e.target.checked);
$('b-dash').onclick = () => window.sprout.openLink(`${APP_URL}#/nodes`);
$('b-unpair').onclick = () => {
  if (confirm('Unpair this computer? Your nodes stop earning here until you pair again. Earnings so far are kept.')) {
    window.sprout.unpair();
  }
};

window.sprout.onState((s) => {
  state = s;
  render();
});
window.sprout.getState().then((s) => {
  state = s;
  render();
});
