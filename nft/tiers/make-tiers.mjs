// Builds the five Grower Node tier images (1000x1000 SVG) and a preview board.
// Run: node make-tiers.mjs  → writes tier-1-seedling.svg … tier-5-evergreen.svg
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const TIERS = [
  { n: 1, slug: 'seedling', name: 'Seedling', roman: 'I', color: '#4BE38A', deep: '#0F3A22', glow: '#2BD46F',
    line: 'Every garden starts with one seed.', supply: 500 },
  { n: 2, slug: 'bloom', name: 'Bloom', roman: 'II', color: '#38E1D0', deep: '#0B3634', glow: '#1FCFC0',
    line: 'Roots spreading. The network grows.', supply: 250 },
  { n: 3, slug: 'canopy', name: 'Canopy', roman: 'III', color: '#5AA8FF', deep: '#0E2A4A', glow: '#3C8EF5',
    line: 'Reaching higher, covering more ground.', supply: 150 },
  { n: 4, slug: 'grove', name: 'Grove', roman: 'IV', color: '#B27BFF', deep: '#2A1550', glow: '#9558F5',
    line: 'Many trees. One strong network.', supply: 70 },
  { n: 5, slug: 'evergreen', name: 'Evergreen', roman: 'V', color: '#FFC94D', deep: '#4A3108', glow: '#F5AE1F',
    line: 'Rooted for good. The rarest Grower.', supply: 30 },
];

// Tiny deterministic random so every render is identical
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function network(t) {
  const r = rng(t.n * 97 + 13);
  const pts = Array.from({ length: 26 }, () => [40 + r() * 920, 40 + r() * 920]);
  let lines = '';
  pts.forEach(([x, y], i) => {
    pts.slice(i + 1).forEach(([x2, y2]) => {
      const d = Math.hypot(x - x2, y - y2);
      if (d < 210) lines += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}"/>`;
    });
  });
  const dots = pts.map(([x, y]) => `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(2 + r() * 3).toFixed(1)}"/>`).join('');
  return `<g stroke="${t.color}" stroke-opacity="0.10" stroke-width="1.5">${lines}</g><g fill="${t.color}" fill-opacity="0.35">${dots}</g>`;
}

// The sprout grows a pair of leaves per tier: tier 1 has 2 leaves, tier 5 has 6 plus a crown bud
function sprout(t) {
  const leaf = 'M0 0C26-30 74-34 112-6C78 26 30 30 0 0Z';
  const baseY = 600;
  const top = 300 - (t.n - 1) * 8;
  let leaves = '';
  const count = t.n + 1;
  for (let i = 0; i < count; i++) {
    const y = baseY - 70 - i * ((baseY - 70 - (top + 40)) / Math.max(1, count - 1));
    const right = i % 2 === 0;
    const s = 1.05 - i * 0.07;
    leaves += `<path d="${leaf}" transform="translate(500 ${y.toFixed(0)}) rotate(${right ? -28 : 208}) scale(${s.toFixed(2)})" fill="url(#leaf)"/>`;
  }
  const crown =
    t.n === 5
      ? `<circle cx="500" cy="${top - 6}" r="16" fill="#FFF3C4"/><circle cx="500" cy="${top - 6}" r="30" fill="none" stroke="#FFF3C4" stroke-opacity="0.5" stroke-width="3"/>`
      : `<path d="M500 ${top + 20}C486 ${top}486 ${top - 20}500 ${top - 34}C514 ${top - 20}514 ${top}500 ${top + 20}Z" fill="${t.color}"/>`;
  return `<path d="M500 ${baseY}V${top + 14}" stroke="${t.color}" stroke-width="10" stroke-linecap="round"/>${leaves}${crown}`;
}

export function tierSvg(t) {
  const pillW = Math.max(300, (t.roman.length + t.name.length + 9) * 21 + 60);
  const pips = [1, 2, 3, 4, 5]
    .map((i) => `<circle cx="${500 + (i - 3) * 34}" cy="905" r="9" fill="${i <= t.n ? t.color : 'none'}" stroke="${t.color}" stroke-opacity="${i <= t.n ? 1 : 0.45}" stroke-width="2.5"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="${t.deep}"/>
      <stop offset="0.65" stop-color="#081008"/>
      <stop offset="1" stop-color="#050805"/>
    </radialGradient>
    <radialGradient id="disc" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="#132016"/>
      <stop offset="1" stop-color="#070b07"/>
    </radialGradient>
    <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${t.color}"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.85"/>
    </linearGradient>
    <radialGradient id="pool" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${t.glow}" stop-opacity="0.75"/>
      <stop offset="1" stop-color="${t.glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>
  ${network(t)}
  <ellipse cx="500" cy="700" rx="250" ry="46" fill="url(#pool)"/>
  <circle cx="500" cy="440" r="236" fill="none" stroke="${t.glow}" stroke-width="18" opacity="0.55" filter="url(#soft)"/>
  <circle cx="500" cy="440" r="228" fill="url(#disc)" stroke="${t.color}" stroke-width="7"/>
  <circle cx="500" cy="440" r="200" fill="none" stroke="${t.color}" stroke-opacity="0.35" stroke-width="2"/>
  <circle cx="500" cy="440" r="186" fill="none" stroke="${t.color}" stroke-opacity="0.18" stroke-width="1.5" stroke-dasharray="4 10"/>
  ${sprout(t)}
  <rect x="34" y="34" width="932" height="932" rx="40" fill="none" stroke="${t.color}" stroke-opacity="0.45" stroke-width="3"/>
  <text x="500" y="118" text-anchor="middle" font-family="DM Sans" font-weight="700" font-size="26" letter-spacing="9" fill="#E8F2E6" fill-opacity="0.85">SPROUT NETWORK</text>
  <rect x="${500 - pillW / 2}" y="146" width="${pillW}" height="50" rx="25" fill="${t.color}" fill-opacity="0.14" stroke="${t.color}" stroke-opacity="0.6" stroke-width="2"/>
  <text x="500" y="180" text-anchor="middle" font-family="DM Sans" font-weight="700" font-size="22" letter-spacing="6" fill="${t.color}">TIER ${t.roman}  ·  ${t.name.toUpperCase()}</text>
  <text x="500" y="790" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="84" fill="#F4F8F1">Grower Node</text>
  <text x="500" y="850" text-anchor="middle" font-family="DM Sans" font-weight="500" font-size="28" fill="${t.color}">${t.line}</text>
  ${pips}
</svg>`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const t of TIERS) fs.writeFileSync(path.join(here, `tier-${t.n}-${t.slug}.svg`), tierSvg(t));
  console.log('Wrote', TIERS.length, 'tier SVGs');
}
