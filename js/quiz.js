import { CHOICES_PER_QUESTION } from './config.js';
import { readingsOf } from './data.js';
import { shuffle } from './util.js';

export function meaningLabel(kanji) {
  return kanji.meanings.slice(0, 2).join(', ');
}

export function readingLabel(kind, group) {
  if (kind === 'on' || !group.okuri.length) return group.r;
  return `${group.r}(${group.okuri[0]})`;
}

function plainReading(label) {
  return label.replace(/[()]/g, '');
}

function pickDistinct(candidates, count, rng, accept) {
  const picked = [];
  const seen = new Set();
  for (const candidate of shuffle(candidates, rng)) {
    if (picked.length >= count) break;
    if (seen.has(candidate.label) || !accept(candidate)) continue;
    seen.add(candidate.label);
    picked.push(candidate);
  }
  return picked;
}

function sameLevel(data, char) {
  return data.byLevel[data.kanji[char].level].chars.filter((c) => c !== char);
}

function lookAlikes(data, char) {
  const parts = new Set(data.partsOf(char));
  return data.order.filter((c) => c !== char && data.partsOf(c).some((p) => parts.has(p)));
}

function overlapsMeaning(a, b) {
  return a.meanings.some((m) => b.meanings.includes(m));
}

function finish(question, answer, distractors, rng) {
  const choices = shuffle([{ label: answer, correct: true }, ...distractors.map((d) => ({ label: d.label, correct: false }))], rng);
  return { ...question, answer, choices };
}

export function meaningQuestion(char, data, rng) {
  const kanji = data.kanji[char];
  const answer = meaningLabel(kanji);
  const pool = sameLevel(data, char).map((c) => ({ char: c, label: meaningLabel(data.kanji[c]) }));
  const distractors = pickDistinct(pool, CHOICES_PER_QUESTION - 1, rng,
    (option) => option.label !== answer && !overlapsMeaning(kanji, data.kanji[option.char]));
  return finish({ type: 'meaning', char, prompt: { kind: 'kanji', text: char }, ask: 'What does this kanji mean?' }, answer, distractors, rng);
}

export function kanjiQuestion(char, data, rng) {
  const kanji = data.kanji[char];
  const accept = (option) => !overlapsMeaning(kanji, data.kanji[option.char]);
  const similar = pickDistinct(lookAlikes(data, char).map((c) => ({ char: c, label: c })), CHOICES_PER_QUESTION - 1, rng, accept);
  const rest = pickDistinct(sameLevel(data, char).map((c) => ({ char: c, label: c })), CHOICES_PER_QUESTION - 1, rng,
    (option) => accept(option) && !similar.some((s) => s.label === option.label));
  const distractors = [...similar, ...rest].slice(0, CHOICES_PER_QUESTION - 1);
  return finish({ type: 'kanji', char, prompt: { kind: 'text', text: meaningLabel(kanji) }, ask: 'Which kanji has this meaning?' }, char, distractors, rng);
}

export function readingGroups(kanji) {
  const all = [...kanji.on.map((group) => ({ kind: 'on', group })), ...kanji.kun.map((group) => ({ kind: 'kun', group }))];
  const withWords = all.filter((item) => item.group.words.length);
  return withWords.length ? withWords : all;
}

export function readingQuestion(char, data, rng) {
  const kanji = data.kanji[char];
  const groups = readingGroups(kanji);
  const { kind, group } = groups[Math.floor(rng() * groups.length)];
  const answer = readingLabel(kind, group);
  const own = readingsOf(kanji);
  const pool = sameLevel(data, char).flatMap((c) => data.kanji[c][kind].map((g) => ({ label: readingLabel(kind, g) })));
  const distractors = pickDistinct(pool, CHOICES_PER_QUESTION - 1, rng,
    (option) => option.label !== answer && !own.has(plainReading(option.label)) && !own.has(option.label.split('(')[0]));
  const ask = kind === 'on' ? 'Which is its on’yomi (音読み)?' : 'Which is its kun’yomi (訓読み)?';
  return finish({ type: 'reading', char, kind, prompt: { kind: 'kanji', text: char }, ask }, answer, distractors, rng);
}

export function wordCandidates(kanji) {
  return [...kanji.on.map((g) => ['on', g]), ...kanji.kun.map((g) => ['kun', g])]
    .flatMap(([kind, group]) => group.words.filter((w) => w.s).map((word) => ({ kind, word })));
}

export function wordQuestion(char, data, rng) {
  const kanji = data.kanji[char];
  const candidates = wordCandidates(kanji);
  const { kind, word } = candidates[Math.floor(rng() * candidates.length)];
  const [start, end] = word.s;
  const segment = word.r.slice(start, end);
  const alternatives = [
    ...kanji[kind === 'on' ? 'kun' : 'on'].map((g) => g.r),
    ...sameLevel(data, char).flatMap((c) => data.kanji[c][kind].map((g) => g.r)),
  ];
  const fakes = alternatives
    .filter((alt) => alt !== segment)
    .map((alt) => ({ label: word.r.slice(0, start) + alt + word.r.slice(end) }));
  const distractors = pickDistinct(fakes, CHOICES_PER_QUESTION - 1, rng, (option) => option.label !== word.r);
  return finish({
    type: 'word',
    char,
    word,
    prompt: { kind: 'word', text: word.w },
    ask: 'How is this word read?',
  }, word.r, distractors, rng);
}

const BUILDERS = { meaning: meaningQuestion, kanji: kanjiQuestion, reading: readingQuestion, word: wordQuestion };

export function availableTypes(char, data) {
  const kanji = data.kanji[char];
  const types = ['meaning', 'kanji'];
  if (kanji.on.length || kanji.kun.length) types.push('reading');
  if (wordCandidates(kanji).length) types.push('word');
  return types;
}

export function makeQuestion(type, char, data, rng) {
  const usable = availableTypes(char, data).includes(type) ? type : 'meaning';
  return BUILDERS[usable](char, data, rng);
}

export function buildQuiz(chars, types, count, data, rng) {
  if (!chars.length || !types.length) return [];
  const order = shuffle(chars, rng);
  return Array.from({ length: count }, (_, i) => {
    const char = order[i % order.length];
    const type = types[(i + Math.floor(i / order.length)) % types.length];
    return makeQuestion(type, char, data, rng);
  });
}

// Two questions per kanji for an SRS review: its meaning and one of its readings.
export function reviewQuestions(char, data, rng) {
  const second = wordCandidates(data.kanji[char]).length && rng() < 0.5 ? 'word' : 'reading';
  return [makeQuestion('meaning', char, data, rng), makeQuestion(second, char, data, rng)];
}
