import { MAX_STAGE, RESCUE_SUFFIX, STORAGE_KEY, STORE_VERSION } from './config.js';
import { dayKey, log } from './util.js';

export function emptyState() {
  return { version: STORE_VERSION, cards: {}, notes: {}, answers: {}, days: {}, settings: {}, removed: {}, updated: 0, resetAt: 0 };
}

export function userKey(uid) {
  return `${STORAGE_KEY}:${uid}`;
}

export function rescueKey(key) {
  return `${key}${RESCUE_SUFFIX}`;
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Validate a saved, synced or imported progress object; throws when it is not one.
export function normalizeState(input) {
  if (!isObject(input) || !isObject(input.cards)) throw new Error('This file is not a Kanji Study progress file.');
  const state = emptyState();
  for (const [char, card] of Object.entries(input.cards)) {
    const stage = Number(card?.stage);
    const due = Number(card?.due);
    if (!Number.isInteger(stage) || stage < 1 || stage > MAX_STAGE || !Number.isFinite(due)) continue;
    state.cards[char] = {
      stage,
      due,
      reviews: Number(card.reviews) || 0,
      lapses: Number(card.lapses) || 0,
      added: Number(card.added) || due,
      ...(card.last ? { last: Number(card.last) } : {}),
    };
  }
  for (const [char, note] of Object.entries(isObject(input.notes) ? input.notes : {})) {
    if (typeof note === 'string' && note.trim()) state.notes[char] = note;
  }
  for (const [char, tally] of Object.entries(isObject(input.answers) ? input.answers : {})) {
    state.answers[char] = { right: Number(tally?.right) || 0, wrong: Number(tally?.wrong) || 0 };
  }
  for (const [day, counts] of Object.entries(isObject(input.days) ? input.days : {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && isObject(counts)) {
      state.days[day] = { reviews: Number(counts.reviews) || 0, correct: Number(counts.correct) || 0, learned: Number(counts.learned) || 0 };
    }
  }
  for (const [char, time] of Object.entries(isObject(input.removed) ? input.removed : {})) {
    if (Number.isFinite(Number(time))) state.removed[char] = Number(time);
  }
  if (isObject(input.settings)) state.settings = { ...input.settings };
  state.updated = Number(input.updated) || 0;
  state.resetAt = Number(input.resetAt) || 0;
  return state;
}

export function isEmptyState(state) {
  return !Object.keys(state.cards).length && !Object.keys(state.notes).length && !Object.keys(state.answers).length;
}

function pickCard(a, b) {
  if (!a || !b) return a || b;
  if ((a.reviews || 0) !== (b.reviews || 0)) return (a.reviews || 0) > (b.reviews || 0) ? a : b;
  return (a.last || a.added || 0) >= (b.last || b.added || 0) ? a : b;
}

function maxCounts(a = {}, b = {}) {
  const merged = { ...b };
  for (const [key, counts] of Object.entries(a)) {
    merged[key] = Object.fromEntries(Object.keys({ ...counts, ...(b[key] || {}) })
      .map((field) => [field, Math.max(counts[field] || 0, b[key]?.[field] || 0)]));
  }
  return merged;
}

/**
 * Combine progress from two devices. A reset or restore on one side discards everything the other
 * side saved before it; otherwise each kanji keeps whichever copy has been reviewed more.
 */
export function mergeStates(a, b) {
  if ((b.updated || 0) < (a.resetAt || 0)) return normalizeState(a);
  if ((a.updated || 0) < (b.resetAt || 0)) return normalizeState(b);
  const [newer, older] = (a.updated || 0) >= (b.updated || 0) ? [a, b] : [b, a];
  const removed = { ...older.removed };
  for (const [char, time] of Object.entries(newer.removed || {})) removed[char] = Math.max(time, removed[char] || 0);
  const cards = {};
  for (const char of new Set([...Object.keys(a.cards), ...Object.keys(b.cards)])) {
    const card = pickCard(a.cards[char], b.cards[char]);
    if (!(removed[char] >= (card.last || card.added || 0))) cards[char] = card;
  }
  return normalizeState({
    cards,
    notes: { ...older.notes, ...newer.notes },
    answers: maxCounts(a.answers, b.answers),
    days: maxCounts(a.days, b.days),
    settings: { ...older.settings, ...newer.settings },
    removed,
    updated: Math.max(a.updated || 0, b.updated || 0),
    resetAt: Math.max(a.resetAt || 0, b.resetAt || 0),
  });
}

export function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createStore(storage = defaultStorage(), initialKey = STORAGE_KEY) {
  let key = initialKey;
  let state = load(key);
  const listeners = new Set();

  function read(fromKey) {
    try {
      return storage?.getItem(fromKey) ?? null;
    } catch (error) {
      log('store.read-failed', error.message);
      return null;
    }
  }

  // Keep the saved text exactly as it was, so a version that cannot read it never destroys it.
  function keepRescue(fromKey, raw, reason) {
    try {
      const kept = storage.getItem(rescueKey(fromKey)) === null;
      if (kept) storage.setItem(rescueKey(fromKey), raw);
      log('store.rescue', { key: fromKey, reason, kept });
    } catch (error) {
      log('store.rescue-failed', error.message);
    }
  }

  function load(fromKey) {
    const raw = read(fromKey);
    if (!raw) return emptyState();
    try {
      const parsed = JSON.parse(raw);
      const loaded = normalizeState(parsed);
      const unread = Object.keys(parsed.cards).length - Object.keys(loaded.cards).length;
      if (unread > 0) keepRescue(fromKey, raw, `${unread} kanji could not be read`);
      return loaded;
    } catch (error) {
      log('store.load-failed', error.message);
      keepRescue(fromKey, raw, error.message);
      return emptyState();
    }
  }

  function save(action, details, { touch = true } = {}) {
    if (touch) state.updated = Date.now();
    try {
      storage?.setItem(key, JSON.stringify(state));
    } catch (error) {
      log('store.save-failed', error.message);
    }
    log(action, details);
    listeners.forEach((listener) => listener(state, action));
  }

  function bumpDay(now, field, amount = 1) {
    const day = dayKey(now);
    const counts = state.days[day] || { reviews: 0, correct: 0, learned: 0 };
    counts[field] += amount;
    state.days[day] = counts;
  }

  return {
    get state() {
      return state;
    },
    get storageKey() {
      return key;
    },
    card: (char) => state.cards[char],
    note: (char) => state.notes[char] || '',
    setting: (name, fallback) => state.settings[name] ?? fallback,
    snapshot: () => normalizeState(JSON.parse(JSON.stringify(state))),
    rescue: () => read(rescueKey(key)),
    clearRescue() {
      try {
        storage?.removeItem(rescueKey(key));
      } catch (error) {
        log('store.rescue-clear-failed', error.message);
      }
      log('store.rescue-cleared', { key });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Switch to another person's saved progress (signing in or out).
    use(nextKey) {
      key = nextKey;
      state = load(key);
      log('store.use', { key });
      listeners.forEach((listener) => listener(state, 'store.use'));
    },
    replace(next, action = 'store.replace') {
      state = normalizeState(next);
      save(action, { cards: Object.keys(state.cards).length }, { touch: false });
    },
    setCard(char, card) {
      state.cards[char] = card;
      delete state.removed[char];
      save('srs.set-card', { char, stage: card.stage, due: new Date(card.due).toISOString() });
    },
    removeCard(char) {
      delete state.cards[char];
      state.removed[char] = Date.now();
      save('srs.reset-card', { char });
    },
    reviewed(char, card, correct, now) {
      state.cards[char] = card;
      bumpDay(now, 'reviews');
      if (correct) bumpDay(now, 'correct');
      save('srs.review', { char, correct, stage: card.stage });
    },
    learned(cardsByChar, now) {
      const chars = Object.keys(cardsByChar);
      Object.assign(state.cards, cardsByChar);
      chars.forEach((char) => delete state.removed[char]);
      bumpDay(now, 'learned', chars.length);
      save('lesson.learned', { chars: chars.join('') });
    },
    answered(char, correct) {
      const tally = state.answers[char] || { right: 0, wrong: 0 };
      tally[correct ? 'right' : 'wrong'] += 1;
      state.answers[char] = tally;
      save('quiz.answer', { char, correct });
    },
    setNote(char, text) {
      if (text.trim()) state.notes[char] = text;
      else delete state.notes[char];
      save('note.save', { char, length: text.length });
    },
    setSetting(name, value) {
      state.settings[name] = value;
      save('settings.set', { key: name, value });
    },
    exportText() {
      log('backup.export', { cards: Object.keys(state.cards).length });
      return JSON.stringify({ app: 'kanji-study', exported: new Date().toISOString(), ...state }, null, 1);
    },
    importText(text) {
      const incoming = normalizeState(JSON.parse(text));
      state = { ...incoming, resetAt: Date.now() };
      save('backup.import', { cards: Object.keys(state.cards).length });
      return Object.keys(state.cards).length;
    },
    reset() {
      const settings = state.settings;
      state = { ...emptyState(), settings, resetAt: Date.now() };
      save('progress.reset');
    },
  };
}

export function streakDays(days, now) {
  const active = (key) => days[key] && (days[key].reviews > 0 || days[key].learned > 0);
  const date = new Date(now);
  if (!active(dayKey(date))) date.setDate(date.getDate() - 1);
  let streak = 0;
  while (active(dayKey(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}
