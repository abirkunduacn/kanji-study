import { NEW_GROUP, STAGE_GROUPS } from '../config.js';
import { kanjiLink, levelTabs, progressCells, stageLegend } from '../render.js';
import { stageCounts } from '../srs.js';
import { esc } from '../util.js';

export function render(ctx, [level], _query, anchor) {
  const { data, store } = ctx;
  const { lessons, chars } = data.byLevel[level];
  const counts = stageCounts(chars, store.state.cards);
  const lessonRows = lessons.map((lesson, i) => {
    const started = lesson.filter((char) => store.card(char)).length;
    const status = started === 0 ? 'Not started' : started === lesson.length ? 'Studied' : `${started} of ${lesson.length} studied`;
    return `
      <li class="lesson" id="lesson-${i + 1}">
        <div class="lesson-head">
          <h3>Lesson ${i + 1}</h3>
          <p class="lesson-status">${esc(status)}</p>
        </div>
        <div class="chip-row">${lesson.map((char) => kanjiLink(char, data, store, 'm')).join('')}</div>
        <div class="lesson-actions">
          <a class="button ${started < lesson.length ? 'button--primary' : ''}" href="#/learn/${level}/${i + 1}">${started === lesson.length ? 'Study again' : 'Start lesson'}</a>
          <a class="button button--quiet" href="#/quick/${level}?lesson=${i + 1}">Quick review</a>
          <a class="button button--quiet" href="#/quiz?level=${level}&lesson=${i + 1}">Quiz</a>
        </div>
      </li>`;
  }).join('');

  ctx.root.innerHTML = `
    ${levelTabs(level, (l) => `#/level/${l}`)}
    <header class="page-head">
      <h1>${esc(level)} kanji</h1>
      <p>${chars.length} kanji in ${lessons.length} lessons. Each lesson teaches the parts first, then the kanji built from them.</p>
      <div class="actions">
        <a class="button" href="#/quick/${level}">Quick review all ${level}</a>
        <a class="button button--quiet" href="#/quiz?level=${level}">Quiz ${level}</a>
      </div>
    </header>
    <section class="level-progress">
      ${progressCells(chars, data, store)}
      ${stageLegend([NEW_GROUP, ...STAGE_GROUPS].map((g) => ({ ...g, label: `${g.label} ${counts[g.id]}` })))}
    </section>
    <ol class="lessons">${lessonRows}</ol>`;

  if (anchor?.startsWith('lesson-')) document.getElementById(anchor)?.scrollIntoView();
}
