import { REVIEW_BATCH_LIMIT, REVIEW_MODES } from '../config.js';
import { reviewQuestions } from '../quiz.js';
import { kanjiSheet, masu } from '../render.js';
import { runQuestions } from '../session.js';
import { dueChars, gradeCard, intervalHours, nextDue, nextStageAfter } from '../srs.js';
import { durationLabel, esc, plural, relativeTime, shuffle } from '../util.js';

const GRADES = [
  { id: 'again', label: 'Forgot', key: '1' },
  { id: 'good', label: 'Knew it', key: '2' },
  { id: 'easy', label: 'Easy', key: '3' },
];

function finishedHtml(results, ctx) {
  const up = results.filter((r) => r.correct).length;
  const down = results.length - up;
  const missed = results.filter((r) => !r.correct).map((r) => r.char);
  const upcoming = nextDue(ctx.store.state.cards, ctx.now());
  return `
    <div class="results">
      <h1>Review done</h1>
      <p class="score">You reviewed ${plural(results.length, 'kanji', 'kanji')}: <strong>${up}</strong> moved up, ${down} will come back sooner.</p>
      ${missed.length ? `<h2>Look at these again</h2><ul class="missed">${missed.map((char) => `<li><a href="#/kanji/${encodeURIComponent(char)}"><span lang="ja" class="missed-kanji">${esc(char)}</span><span>${esc(ctx.data.kanji[char].meanings.slice(0, 2).join(', '))}</span></a></li>`).join('')}</ul>` : ''}
      <p>${upcoming ? `Next review ${relativeTime(upcoming, ctx.now())}.` : ''}</p>
      <div class="actions"><a class="button button--primary" href="#/">Home</a><a class="button" href="#/quick/N5?show=studied">Quick review</a></div>
    </div>`;
}

export function render(ctx) {
  const { data, store, root } = ctx;
  const now = ctx.now();
  const due = dueChars(store.state.cards, now).filter((char) => data.isStudy(char));
  let cleanup = null;

  if (!due.length) {
    const upcoming = nextDue(store.state.cards, now);
    root.innerHTML = `<div class="empty">
      <p class="empty-title">Nothing to review right now</p>
      <p>${upcoming ? `Your next review is ${relativeTime(upcoming, now)}.` : 'Kanji you study in a lesson come back here for review.'}</p>
      <div class="actions"><a class="button button--primary" href="#/">Find the next lesson</a><a class="button" href="#/quiz">Practice quiz</a></div>
    </div>`;
    return undefined;
  }

  const batch = due.slice(0, REVIEW_BATCH_LIMIT);
  const mode = store.setting('reviewMode', 'quiz');
  root.innerHTML = `
    <section class="review-start">
      <h1>${plural(due.length, 'kanji', 'kanji')} to review</h1>
      ${due.length > batch.length ? `<p>This session covers the first ${batch.length}. The rest stay ready for the next one.</p>` : ''}
      <div class="masu-row">${batch.slice(0, 20).map((c) => masu(c, 's')).join('')}</div>
      <fieldset class="mode-pick">
        <legend>How do you want to review?</legend>
        ${REVIEW_MODES.map((m) => `<label><input type="radio" name="mode" value="${m.id}" ${m.id === mode ? 'checked' : ''}><span><strong>${esc(m.label)}</strong> ${esc(m.hint)}</span></label>`).join('')}
      </fieldset>
      <button class="button button--primary" data-action="begin">Start review</button>
    </section>`;

  const results = [];
  function grade(char, gradeId) {
    const card = gradeCard(store.card(char), gradeId, ctx.now());
    store.reviewed(char, card, gradeId !== 'again', ctx.now());
    results.push({ char, correct: gradeId !== 'again' });
    ctx.refreshBadge();
  }

  function quizMode() {
    const perChar = new Map(batch.map((char) => [char, { left: 2, ok: true }]));
    const questions = shuffle(batch.flatMap((char) => reviewQuestions(char, data, Math.random)));
    cleanup = runQuestions(root, {
      questions,
      data,
      title: 'Review',
      onAnswer(question, correct) {
        const state = perChar.get(question.char);
        state.left -= 1;
        state.ok = state.ok && correct;
        if (state.left === 0) grade(question.char, state.ok ? 'good' : 'again');
      },
      onComplete: () => { root.innerHTML = finishedHtml(results, ctx); },
    });
  }

  function cardMode() {
    const queue = shuffle(batch);
    let index = 0;
    let revealed = false;
    function show() {
      if (index >= queue.length) {
        root.innerHTML = finishedHtml(results, ctx);
        return;
      }
      const char = queue[index];
      const card = store.card(char);
      revealed = false;
      root.innerHTML = `
        <section class="flashcard">
          <div class="session-top"><p class="session-title">Flashcards</p><p class="session-count">${index + 1} <span>of ${queue.length}</span></p></div>
          <div class="progress"><span style="width:${(index / queue.length) * 100}%"></span></div>
          <div class="flash-front">${masu(char, 'xl')}<p class="ask">Recall its meaning and readings, then check.</p>
            <button class="button button--primary" data-action="reveal">Show answer</button></div>
          <div class="flash-back" hidden>
            ${kanjiSheet(char, data, { link: false })}
            <div class="grades">${GRADES.map((g) => `<button class="button grade grade--${g.id}" data-grade="${g.id}"><span class="key" aria-hidden="true">${g.key}</span>${g.label}<span class="grade-next">next in ${durationLabel(intervalHours(nextStageAfter(card, g.id)))}</span></button>`).join('')}</div>
          </div>
        </section>`;
      root.querySelector('[data-action="reveal"]').focus({ preventScroll: true });
    }
    function reveal() {
      revealed = true;
      root.querySelector('.flash-front').hidden = true;
      root.querySelector('.flash-back').hidden = false;
      window.scrollTo({ top: 0 });
      root.querySelector('.grade--good').focus({ preventScroll: true });
    }
    function onClick(event) {
      if (event.target.closest('[data-action="reveal"]')) reveal();
      const gradeButton = event.target.closest('[data-grade]');
      if (gradeButton) { grade(queue[index], gradeButton.dataset.grade); index += 1; show(); }
    }
    function onKey(event) {
      if (event.target.matches('input, textarea, select') || index >= queue.length) return;
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); reveal(); return; }
      const pick = GRADES.find((g) => g.key === event.key);
      if (revealed && pick) { grade(queue[index], pick.id); index += 1; show(); }
    }
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    cleanup = () => { root.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
    show();
  }

  function onBegin(event) {
    if (!event.target.closest('[data-action="begin"]')) return;
    const chosen = root.querySelector('input[name="mode"]:checked')?.value || 'quiz';
    store.setSetting('reviewMode', chosen);
    root.removeEventListener('click', onBegin);
    if (chosen === 'cards') cardMode();
    else quizMode();
  }
  root.addEventListener('click', onBegin);
  return () => {
    root.removeEventListener('click', onBegin);
    cleanup?.();
  };
}
