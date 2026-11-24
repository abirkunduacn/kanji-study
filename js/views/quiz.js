import { DEFAULT_QUIZ_SIZE, LEVELS, QUESTION_TYPES, QUIZ_SIZES } from '../config.js';
import { buildQuiz } from '../quiz.js';
import { resultsHtml, runQuestions } from '../session.js';
import { esc } from '../util.js';

const SOURCES = [
  { id: 'all', label: 'All kanji in the level' },
  { id: 'studied', label: 'Only kanji I have studied' },
  { id: 'weak', label: 'Kanji I often miss' },
];

function pickChars(ctx, levels, lesson, source) {
  const { data, store } = ctx;
  const base = lesson && levels.length === 1
    ? data.byLevel[levels[0]].lessons[lesson - 1] || []
    : levels.flatMap((level) => data.byLevel[level].chars);
  return base.filter((char) => {
    if (source === 'studied') return Boolean(store.card(char));
    if (source === 'weak') {
      const tally = store.state.answers[char];
      return (store.card(char)?.lapses || 0) > 0 || (tally && tally.wrong > 0);
    }
    return true;
  });
}

export function render(ctx, _params, query) {
  const { data, store, root } = ctx;
  const presetLevel = LEVELS.includes(query.get('level')) ? query.get('level') : null;
  const lesson = Number(query.get('lesson')) || 0;
  const savedTypes = store.setting('quizTypes', ['meaning', 'reading', 'word']);
  let cleanup = null;

  root.innerHTML = `
    <header class="page-head">
      <h1>Practice quiz</h1>
      <p>Quiz yourself on any level. Practice does not change your review schedule, but kanji you miss show up under "Often missed".</p>
    </header>
    <form class="quiz-setup">
      <fieldset><legend>Levels</legend>
        ${LEVELS.map((level) => `<label class="check"><input type="checkbox" name="level" value="${level}" ${(presetLevel ? presetLevel === level : level === 'N5') ? 'checked' : ''}> ${level}</label>`).join('')}
      </fieldset>
      ${lesson && presetLevel ? `<p class="hint">Only ${esc(presetLevel)} lesson ${lesson}. <a href="#/quiz?level=${esc(presetLevel)}">Use the whole level</a></p>` : ''}
      <fieldset><legend>Kanji</legend>
        ${SOURCES.map((s, i) => `<label class="check"><input type="radio" name="source" value="${s.id}" ${i === 0 ? 'checked' : ''}> ${esc(s.label)}</label>`).join('')}
      </fieldset>
      <fieldset><legend>Question types</legend>
        ${QUESTION_TYPES.map((t) => `<label class="check"><input type="checkbox" name="type" value="${t.id}" ${savedTypes.includes(t.id) ? 'checked' : ''}> ${esc(t.label)}</label>`).join('')}
      </fieldset>
      <fieldset><legend>Questions</legend>
        ${QUIZ_SIZES.map((n) => `<label class="check"><input type="radio" name="count" value="${n}" ${n === DEFAULT_QUIZ_SIZE ? 'checked' : ''}> ${n}</label>`).join('')}
      </fieldset>
      <p class="form-error" aria-live="polite"></p>
      <button class="button button--primary" type="submit">Start quiz</button>
    </form>`;

  const form = root.querySelector('.quiz-setup');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const levels = values.getAll('level');
    const types = values.getAll('type');
    const chars = pickChars(ctx, levels, lesson, values.get('source'));
    const error = form.querySelector('.form-error');
    if (!levels.length) { error.textContent = 'Choose at least one level.'; return; }
    if (!types.length) { error.textContent = 'Choose at least one question type.'; return; }
    if (!chars.length) { error.textContent = 'No kanji match. Study a lesson first, or choose "All kanji in the level".'; return; }
    store.setSetting('quizTypes', types);
    const questions = buildQuiz(chars, types, Number(values.get('count')), data, Math.random);
    cleanup = runQuestions(root, {
      questions,
      data,
      title: `Quiz ${levels.join(', ')}`,
      onAnswer: (question, correct) => store.answered(question.char, correct),
      onComplete: (summary) => {
        root.innerHTML = `${resultsHtml(summary, data, 'Quiz done')}<div class="actions"><a class="button button--primary" href="#/quiz${presetLevel ? `?level=${presetLevel}${lesson ? `&lesson=${lesson}` : ''}` : ''}">New quiz</a><a class="button" href="#/">Home</a></div>`;
      },
    });
  });
  return () => cleanup?.();
}
