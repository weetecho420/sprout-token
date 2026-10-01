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
