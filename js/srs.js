import { MAX_STAGE, NEW_GROUP, SRS_INTERVALS_HOURS, STAGE_GROUPS } from './config.js';
import { addDays, startOfDay } from './util.js';

const HOUR = 3600 * 1000;

export function intervalHours(stage) {
  return SRS_INTERVALS_HOURS[Math.min(MAX_STAGE, Math.max(1, stage))];
}

export function startCard(now, stage = 1) {
  return { stage, due: now + intervalHours(stage) * HOUR, reviews: 0, lapses: 0, added: now };
}

// grade: 'again' (forgot), 'good' (knew it) or 'easy' (knew it instantly)
export function gradeCard(card, grade, now) {
  const next = { ...card, reviews: (card.reviews || 0) + 1, last: now };
  if (grade === 'again') {
    next.stage = Math.max(1, card.stage - (card.stage >= 5 ? 2 : 1));
    next.lapses = (card.lapses || 0) + 1;
  } else {
    next.stage = Math.min(MAX_STAGE, card.stage + (grade === 'easy' ? 2 : 1));
  }
  next.due = now + intervalHours(next.stage) * HOUR;
  return next;
}

export function nextStageAfter(card, grade) {
  return gradeCard(card, grade, 0).stage;
}

export function isDue(card, now) {
  return Boolean(card) && card.due <= now;
}

export function stageGroup(card) {
  if (!card || !card.stage) return NEW_GROUP;
  return STAGE_GROUPS.find((group) => card.stage >= group.min && card.stage <= group.max) || STAGE_GROUPS[0];
}

export function dueChars(cards, now) {
  return Object.entries(cards)
    .filter(([, card]) => isDue(card, now))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([char]) => char);
}

export function nextDue(cards, now) {
  const upcoming = Object.values(cards).filter((card) => card.due > now).map((card) => card.due);
  return upcoming.length ? Math.min(...upcoming) : null;
}

// Reviews per day for the next `days` days; overdue cards count toward today.
export function forecast(cards, now, days) {
  const buckets = Array.from({ length: days }, (_, i) => ({ start: addDays(startOfDay(now), i), count: 0 }));
  const end = addDays(startOfDay(now), days);
  for (const card of Object.values(cards)) {
    if (card.due >= end) continue;
    const index = buckets.findLastIndex((bucket) => card.due >= bucket.start);
    buckets[Math.max(0, index)].count += 1;
  }
  return buckets;
}

export function stageCounts(chars, cards) {
  const counts = { [NEW_GROUP.id]: 0 };
  for (const group of STAGE_GROUPS) counts[group.id] = 0;
  for (const char of chars) counts[stageGroup(cards[char]).id] += 1;
  return counts;
}
