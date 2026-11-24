import { DATA_URL, LEVELS, SEARCH_LIMIT } from './config.js';
import { kataToHira, log } from './util.js';

export async function loadData(fetchFn = fetch) {
  const response = await fetchFn(DATA_URL);
  if (!response.ok) throw new Error(`Kanji data could not be loaded (HTTP ${response.status}).`);
  const data = indexData(await response.json());
  log('data.loaded', { kanji: data.order.length, built: data.built });
  return data;
}

export function indexData(raw) {
  const byLevel = {};
  const order = [];
  for (const level of LEVELS) {
    const lessons = raw.levels?.[level]?.lessons || [];
    byLevel[level] = { lessons, chars: lessons.flat() };
    order.push(...byLevel[level].chars);
  }
  const position = new Map(order.map((char, i) => [char, i]));
  const data = {
    ...raw,
    byLevel,
    order,
    position,
    isStudy: (char) => Boolean(raw.kanji[char]),
    partsOf: (char) => partsOf(raw, char),
    meaningOf: (char) => meaningOf(raw, char),
  };
  data.children = buildChildren(data);
  data.familySize = memoFamilySize(data);
  return data;
}

export function partsOf(raw, char) {
  const kanji = raw.kanji[char];
  if (kanji) return [...new Set(kanji.parts.flatMap((p) => [p.c, p.base]).filter((p) => p && p !== char))];
  const component = raw.components?.[char];
  if (!component) return [];
  return [...new Set([...component.parts, ...(component.bases || [])])].filter((p) => p !== char);
}

export function meaningOf(raw, char) {
  if (raw.kanji[char]) return raw.kanji[char].meanings[0] || '';
  return raw.components?.[char]?.m || '';
}

// For every part, the kanji and components that contain it directly.
export function buildChildren(data) {
  const children = new Map();
  const nodes = [...data.order, ...Object.keys(data.components || {})];
  for (const node of nodes) {
    for (const part of data.partsOf(node)) {
      if (!children.has(part)) children.set(part, new Set());
      children.get(part).add(node);
    }
  }
  const rank = (char) => (data.position.has(char) ? data.position.get(char) : Infinity);
  const sorted = new Map();
  for (const [part, set] of children) sorted.set(part, [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)));
  return sorted;
}

// Study kanji that contain `char` anywhere below it in the family tree.
export function familyMembers(data, char) {
  const members = new Set();
  const seen = new Set([char]);
  const stack = [...(data.children.get(char) || [])];
  while (stack.length) {
    const node = stack.pop();
    if (seen.has(node)) continue;
    seen.add(node);
    if (data.isStudy(node)) members.add(node);
    stack.push(...(data.children.get(node) || []));
  }
  return members;
}

function memoFamilySize(data) {
  const cache = new Map();
  return (char) => {
    if (!cache.has(char)) cache.set(char, familyMembers(data, char).size);
    return cache.get(char);
  };
}

export function familyRoots(data, minMembers, limit) {
  return [...data.children.keys()]
    .map((char) => ({ char, size: data.familySize(char) }))
    .filter((root) => root.size >= minMembers)
    .sort((a, b) => b.size - a.size || a.char.localeCompare(b.char))
    .slice(0, limit);
}

export function kunText(group, okuri) {
  return okuri ? `${group.r}${okuri}` : group.r;
}

export function readingsOf(kanji) {
  const set = new Set();
  for (const group of kanji.on) set.add(group.r);
  for (const group of kanji.kun) {
    set.add(group.r);
    for (const okuri of group.okuri) set.add(kunText(group, okuri));
  }
  return set;
}

export function search(data, query, limit = SEARCH_LIMIT) {
  const text = query.trim();
  if (!text) return [];
  const lower = kataToHira(text.toLowerCase());
  const scored = [];
  for (const char of data.order) {
    const kanji = data.kanji[char];
    let score = null;
    if (text.includes(char)) score = 0;
    else {
      const readings = readingsOf(kanji);
      if (readings.has(lower)) score = 1;
      else if (kanji.meanings.some((m) => m.toLowerCase() === lower)) score = 1;
      else if ([...readings].some((r) => r.startsWith(lower)) && /[぀-ゟ]/.test(lower)) score = 2;
      else if (lower.length >= 2 && kanji.meanings.some((m) => m.toLowerCase().includes(lower))) score = 3;
    }
    if (score !== null) scored.push({ char, score });
  }
  return scored.sort((a, b) => a.score - b.score || data.position.get(a.char) - data.position.get(b.char))
    .slice(0, limit)
    .map((item) => item.char);
}

export function lessonOf(data, char) {
  const kanji = data.kanji[char];
  return kanji ? data.byLevel[kanji.level].lessons[kanji.lesson - 1] : [];
}
