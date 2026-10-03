import { CONFIG } from './config';

export function formatDate(ms) {
  return new Date(ms).toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function countdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export const fmt = (n) => Number(n).toLocaleString('en-US');

export const solText = (n) => `${Math.round(n * 1000) / 1000} SOL`;

export const minPerDay = CONFIG.stages[0].perDay;
export const maxPerDay = CONFIG.stages[CONFIG.stages.length - 1].perDay;

/** 3725 → "1h 02m"; under an hour shows minutes and seconds. */
export function duration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${pad(m)}m`;
  return `${m}m ${pad(s % 60)}s`;
}

/** $SPROUT amounts: 2 decimals under 1,000, whole numbers above. */
export const sprout = (n) =>
  Number(n).toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : 2, minimumFractionDigits: n >= 1000 ? 0 : 2 });
