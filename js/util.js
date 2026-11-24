import { LOG_PREFIX } from './config.js';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export function log(action, details) {
  try {
    console.info(LOG_PREFIX, action, details ?? '');
  } catch {
    // console can be unavailable in some embedded browsers
  }
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function kataToHira(text) {
  return String(text).replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

const pad = (n) => String(n).padStart(2, '0');

export function dayKey(time) {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(time) {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(time, days) {
  const d = new Date(time);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}

export function relativeTime(target, now) {
  const diff = target - now;
  if (diff <= 0) return 'now';
  if (diff < HOUR) return `in ${plural(Math.max(1, Math.round(diff / 60000)), 'minute')}`;
  if (diff < DAY) return `in ${plural(Math.round(diff / HOUR), 'hour')}`;
  if (diff < 30 * DAY) return `in ${plural(Math.round(diff / DAY), 'day')}`;
  return `in ${plural(Math.round(diff / (30 * DAY)), 'month')}`;
}

export function durationLabel(hours) {
  if (hours < 24) return plural(hours, 'hour');
  if (hours < 24 * 30) return plural(Math.round(hours / 24), 'day');
  return plural(Math.round(hours / (24 * 30)), 'month');
}

// Small seeded generator so quizzes can be reproduced in tests.
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function parseHash(hash) {
  const [raw, anchor = ''] = (hash || '').replace(/^#/, '').split('#');
  const [path, queryString = ''] = (raw || '/').split('?');
  return { path: path || '/', query: new URLSearchParams(queryString), anchor };
}
