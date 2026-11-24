import { HOME_PREVIEW_LIMIT, LEVELS, NEW_GROUP, STAGE_GROUPS } from '../config.js';
import { masu, progressCells, stageLegend } from '../render.js';
import { dueChars, nextDue, stageCounts } from '../srs.js';
import { streakDays } from '../store.js';
import { dayKey, esc, plural, relativeTime } from '../util.js';

export function nextLesson(data, store) {
  for (const level of LEVELS) {
    const lessons = data.byLevel[level].lessons;
    const index = lessons.findIndex((lesson) => lesson.some((char) => !store.card(char)));
    if (index >= 0) return { level, number: index + 1, chars: lessons[index] };
  }
  return null;
}

function todayPanel(ctx) {
  const { data, store } = ctx;
  const now = ctx.now();
  const cards = store.state.cards;
  const due = dueChars(cards, now);
  const lesson = nextLesson(data, store);
  const upcoming = nextDue(cards, now);

  const review = due.length
    ? `<div class="today-block">
        <h2>${plural(due.length, 'kanji', 'kanji')} ready to review</h2>
        <div class="masu-row">${due.slice(0, HOME_PREVIEW_LIMIT).map((c) => masu(c, 's')).join('')}${due.length > HOME_PREVIEW_LIMIT ? `<span class="more">+${due.length - HOME_PREVIEW_LIMIT}</span>` : ''}</div>
        <a class="button button--primary" href="#/review">Start review</a>
      </div>`
    : `<div class="today-block">
        <h2>No reviews waiting</h2>
        <p>${upcoming ? `Your next review is ${relativeTime(upcoming, now)}.` : 'Finish a lesson and its kanji will come back here for review.'}</p>
      </div>`;

  const learn = lesson
    ? `<div class="today-block">
        <h2>Next lesson: ${lesson.level} lesson ${lesson.number}</h2>
        <div class="masu-row">${lesson.chars.map((c) => masu(c, 's', store.card(c) ? 'is-known' : '')).join('')}</div>
        <a class="button ${due.length ? '' : 'button--primary'}" href="#/learn/${lesson.level}/${lesson.number}">Start lesson</a>
      </div>`
    : '<div class="today-block"><h2>Every lesson is done</h2><p>Keep up with reviews to move kanji to mastered.</p></div>';

  const today = store.state.days[dayKey(now)] || { reviews: 0, learned: 0 };
  const streak = streakDays(store.state.days, now);
  return `
    <section class="today" aria-labelledby="today-title">
      <h1 id="today-title" class="sr-only">Today</h1>
      ${review}
      ${learn}
      <p class="today-stats">Today: ${plural(today.reviews, 'review')}, ${plural(today.learned, 'new kanji', 'new kanji')}. ${streak ? `${plural(streak, 'day')} in a row.` : ''}</p>
    </section>`;
}

function levelsPanel(ctx) {
  const { data, store } = ctx;
  const rows = LEVELS.map((level) => {
    const chars = data.byLevel[level].chars;
    const counts = stageCounts(chars, store.state.cards);
    const started = chars.length - counts[NEW_GROUP.id];
    return `
      <section class="level-row">
        <div class="level-row-head">
          <h2><a href="#/level/${level}">${level}</a></h2>
          <p>${started} of ${chars.length} started, ${counts.mastered} mastered</p>
          <div class="level-row-links">
            <a href="#/level/${level}">Lessons</a>
            <a href="#/quick/${level}">Quick review</a>
          </div>
        </div>
        ${progressCells(chars, data, store)}
      </section>`;
  }).join('');
  return `
    <section class="levels" aria-labelledby="levels-title">
      <div class="section-head">
        <h2 id="levels-title">Your kanji</h2>
        ${stageLegend([NEW_GROUP, ...STAGE_GROUPS])}
      </div>
      ${rows}
    </section>`;
}

export function render(ctx) {
  ctx.root.innerHTML = `
    ${todayPanel(ctx)}
    ${levelsPanel(ctx)}
    <section class="explore">
      <a class="explore-link" href="#/family"><span lang="ja">系</span><span><strong>Family map</strong> See which kanji are built from the same parts.</span></a>
      <a class="explore-link" href="#/quiz"><span lang="ja">問</span><span><strong>Practice quiz</strong> Test any level without changing your review schedule.</span></a>
      <a class="explore-link" href="#/settings"><span lang="ja">保</span><span><strong>Backup</strong> Save your progress to a file or move it to another device.</span></a>
    </section>
    <p class="data-note">${esc(String(ctx.data.order.length))} kanji from JLPT N5 to N2.</p>`;
}
