import { KNOWN_STAGE, SRS_INTERVALS_HOURS, SWIPE_MIN_PX } from '../config.js';
import { meaningQuestion, readingQuestion } from '../quiz.js';
import { kanjiSheet, masu } from '../render.js';
import { resultsHtml, runQuestions } from '../session.js';
import { startCard } from '../srs.js';
import { durationLabel, esc, log, plural, replaceHash, shuffle } from '../util.js';

// Finished lessons' results by lesson address, so they come back after opening a missed kanji.
const results = new Map();

/** Address of a lesson; `step` is a card index, 'done' for the results, or null for the intro. */
export function lessonHash(level, number, step = null) {
  const base = `#/learn/${level}/${number}`;
  if (step === null) return base;
  return `${base}?step=${step === 'done' ? 'done' : step + 1}`;
}

/** The step saved in a lesson address: a card index, 'done', or null when there is none or it is out of range. */
export function stepFromQuery(query, count) {
  const value = query?.get('step');
  if (value === 'done') return 'done';
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= count ? number - 1 : null;
}

export function render(ctx, [level, number], query) {
  const { data, store, root } = ctx;
  const lessonNumber = Number(number);
  const chars = data.byLevel[level]?.lessons[lessonNumber - 1];
  if (!chars) {
    root.innerHTML = `<div class="empty"><p class="empty-title">That lesson does not exist.</p><p><a href="#/level/${esc(level)}">Back to ${esc(level)} lessons</a></p></div>`;
    return undefined;
  }
  const title = `${level} lesson ${lessonNumber}`;
  const hasNext = lessonNumber < data.byLevel[level].lessons.length;
  const address = lessonHash(level, lessonNumber);
  let cleanup = null;
  let step = 0;

  function addToReviews(stage) {
    const now = ctx.now();
    const added = {};
    for (const char of chars) if (!store.card(char)) added[char] = startCard(now, stage);
    if (Object.keys(added).length) store.learned(added, now);
    ctx.refreshBadge();
    return Object.keys(added).length;
  }

  function intro() {
    const fresh = chars.filter((char) => !store.card(char)).length;
    replaceHash(address);
    root.innerHTML = `
      <section class="lesson-intro">
        <p class="crumbs"><a href="#/level/${level}">${level}</a></p>
        <h1>${esc(title)}</h1>
        <div class="masu-row masu-row--big">${chars.map((c) => masu(c, 'm', store.card(c) ? 'is-known' : '')).join('')}</div>
        <p>${fresh ? `${plural(fresh, 'kanji', 'kanji')} new to you.` : 'You have studied all of these already. Go through them again any time.'} Read each one, then take a short quiz. Passing it adds the new kanji to your reviews.</p>
        <div class="actions">
          <button class="button button--primary" data-action="start">Start</button>
          ${fresh ? '<button class="button button--quiet" data-action="known">I know these already</button>' : ''}
        </div>
      </section>`;
  }

  function card() {
    const char = chars[step];
    replaceHash(lessonHash(level, lessonNumber, step));
    root.innerHTML = `
      <section class="lesson-card">
        <div class="session-top">
          <p class="session-title">${esc(title)}</p>
          <p class="session-count">${step + 1} <span>of ${chars.length}</span></p>
        </div>
        <div class="progress"><span style="width:${(step / chars.length) * 100}%"></span></div>
        ${kanjiSheet(char, data, { link: false })}
        ${step === 0 ? '<p class="swipe-hint">Swipe left for the next kanji.</p>' : ''}
        <div class="actions actions--split">
          <button class="button button--quiet" data-action="back" ${step === 0 ? 'disabled' : ''}>Back</button>
          <button class="button button--primary" data-action="next">${step === chars.length - 1 ? 'Take the quiz' : 'Next kanji'}</button>
        </div>
      </section>`;
    root.querySelector('[data-action="next"]').focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function quiz() {
    const questions = shuffle(chars.flatMap((char) => [meaningQuestion(char, data, Math.random), readingQuestion(char, data, Math.random)]));
    cleanup = runQuestions(root, {
      questions,
      data,
      title: `${title} quiz`,
      onAnswer: (question, correct) => store.answered(question.char, correct),
      onComplete: (summary) => done(summary),
    });
  }

  function done(summary) {
    results.set(address, { summary, added: addToReviews(1) });
    replaceHash(lessonHash(level, lessonNumber, 'done'));
    showResults();
  }

  function showResults() {
    const { summary, added } = results.get(address);
    root.innerHTML = `
      ${resultsHtml(summary, data, `${title} done`)}
      <p>${added ? `Added ${plural(added, 'kanji', 'kanji')} to your reviews. The first review is in ${durationLabel(SRS_INTERVALS_HOURS[1])}.` : 'These kanji were already in your reviews, so their schedule did not change.'}</p>
      <div class="actions">
        ${hasNext ? `<a class="button button--primary" href="#/learn/${level}/${lessonNumber + 1}">Next lesson</a>` : ''}
        <a class="button" href="#/level/${level}">Back to ${level}</a>
      </div>`;
  }

  function onClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'start') { step = 0; card(); }
    if (action === 'next') { if (step < chars.length - 1) { step += 1; card(); } else quiz(); }
    if (action === 'back' && step > 0) { step -= 1; card(); }
    if (action === 'known') {
      const added = addToReviews(KNOWN_STAGE);
      root.innerHTML = `<div class="results"><h1>Marked as known</h1><p>Added ${plural(added, 'kanji', 'kanji')} at the strong stage, so they come back less often.</p>
        <div class="actions">${hasNext ? `<a class="button button--primary" href="#/learn/${level}/${lessonNumber + 1}">Next lesson</a>` : ''}<a class="button" href="#/level/${level}">Back to ${level}</a></div></div>`;
    }
  }

  function onKey(event) {
    if (!root.querySelector('.lesson-card') || event.target.matches('input, textarea, select')) return;
    if (event.key === 'ArrowRight') root.querySelector('[data-action="next"]')?.click();
    if (event.key === 'ArrowLeft') root.querySelector('[data-action="back"]')?.click();
  }

  let touchStart = null;
  function onTouchStart(event) {
    if (!root.querySelector('.lesson-card') || event.touches.length !== 1) return;
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  function onTouchEnd(event) {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    root.querySelector(`[data-action="${dx < 0 ? 'next' : 'back'}"]`)?.click();
  }

  root.addEventListener('click', onClick);
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchend', onTouchEnd);
  document.addEventListener('keydown', onKey);
  const resume = stepFromQuery(query, chars.length);
  const canResume = Number.isInteger(resume) || (resume === 'done' && results.has(address));
  if (!canResume) intro();
  else {
    log('lesson.resume', { lesson: title, step: resume });
    if (resume === 'done') showResults();
    else { step = resume; card(); }
  }
  return () => {
    cleanup?.();
    root.removeEventListener('click', onClick);
    root.removeEventListener('touchstart', onTouchStart);
    root.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('keydown', onKey);
  };
}
