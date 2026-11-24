import { LEVELS } from '../config.js';
import { kanjiSheet, levelTabs } from '../render.js';
import { isDue } from '../srs.js';
import { esc, shuffle } from '../util.js';

const FILTERS = [
  { id: 'all', label: 'All kanji' },
  { id: 'studied', label: 'Studied' },
  { id: 'due', label: 'Due for review' },
  { id: 'weak', label: 'Often missed' },
];

function isWeak(char, store) {
  const card = store.card(char);
  const tally = store.state.answers[char];
  return (card?.lapses || 0) > 0 || (tally && tally.wrong > tally.right);
}

function selectChars(ctx, level, lesson, filter) {
  const { data, store } = ctx;
  const source = lesson ? data.byLevel[level].lessons[lesson - 1] || [] : data.byLevel[level].chars;
  const now = ctx.now();
  return source.filter((char) => {
    if (filter === 'studied') return Boolean(store.card(char));
    if (filter === 'due') return isDue(store.card(char), now);
    if (filter === 'weak') return isWeak(char, store);
    return true;
  });
}

function hrefFor(level, query) {
  const params = new URLSearchParams(query);
  const text = params.toString();
  return `#/quick/${level}${text ? `?${text}` : ''}`;
}

export function render(ctx, [levelParam], query) {
  const { data } = ctx;
  const level = LEVELS.includes(levelParam) ? levelParam : LEVELS[0];
  const lesson = Number(query.get('lesson')) || 0;
  const filter = FILTERS.some((f) => f.id === query.get('show')) ? query.get('show') : 'all';
  const hide = query.get('hide') === '1';
  const order = query.get('order') === 'shuffle' ? 'shuffle' : 'lesson';
  let chars = selectChars(ctx, level, lesson, filter);
  if (order === 'shuffle') chars = shuffle(chars);

  const lessonOptions = data.byLevel[level].lessons.map((_, i) => `<option value="${i + 1}" ${lesson === i + 1 ? 'selected' : ''}>Lesson ${i + 1}</option>`).join('');
  const keep = { ...(filter !== 'all' ? { show: filter } : {}), ...(hide ? { hide: 1 } : {}), ...(order === 'shuffle' ? { order } : {}) };

  ctx.root.innerHTML = `
    ${levelTabs(level, (l) => hrefFor(l, keep))}
    <header class="page-head">
      <h1>Quick review ${esc(level)}</h1>
      <p>Each kanji with its meaning, readings in hiragana and the most common words for each reading. Turn on <em>Test myself</em> to hide the answers until you tap a card.</p>
    </header>
    <form class="filters" aria-label="Quick review options">
      <label>Lesson
        <select name="lesson"><option value="">All lessons</option>${lessonOptions}</select>
      </label>
      <label>Show
        <select name="show">${FILTERS.map((f) => `<option value="${f.id}" ${filter === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
      </label>
      <label>Order
        <select name="order"><option value="lesson">Lesson order</option><option value="shuffle" ${order === 'shuffle' ? 'selected' : ''}>Shuffled</option></select>
      </label>
      <label class="toggle"><input type="checkbox" name="hide" ${hide ? 'checked' : ''}> Test myself</label>
    </form>
    <p class="result-count">${chars.length} kanji</p>
    <div class="sheets">
      ${chars.length ? chars.map((char) => kanjiSheet(char, data, { hidden: hide })).join('') : '<p class="empty">No kanji match these options. Try "All kanji".</p>'}
    </div>`;

  const form = ctx.root.querySelector('.filters');
  form.addEventListener('change', () => {
    const values = new FormData(form);
    const next = {};
    if (values.get('lesson')) next.lesson = values.get('lesson');
    if (values.get('show') !== 'all') next.show = values.get('show');
    if (values.get('order') === 'shuffle') next.order = 'shuffle';
    if (values.get('hide')) next.hide = 1;
    window.location.hash = hrefFor(level, next);
  });

  ctx.root.querySelector('.sheets').addEventListener('click', (event) => {
    const sheet = event.target.closest('.sheet.is-hidden');
    if (!sheet || event.target.closest('a')) return;
    sheet.classList.remove('is-hidden');
    sheet.querySelector('.reveal')?.remove();
  });
}
