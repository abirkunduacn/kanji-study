import { AUTO_ADVANCE_MS } from './config.js';
import { highlightReading, masu } from './render.js';
import { esc } from './util.js';

const CIRCLE = '<svg class="maru" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true"><path d="M60 6c30 0 54 9 54 23s-25 25-56 25S5 44 6 29 33 5 66 7"/></svg>';

function promptHtml(question) {
  if (question.prompt.kind === 'kanji') return masu(question.prompt.text, 'xl');
  if (question.prompt.kind === 'word') return `<p class="prompt-word" lang="ja">${esc(question.prompt.text)}</p>`;
  return `<p class="prompt-text">${esc(question.prompt.text)}</p>`;
}

function explainHtml(question, data) {
  const kanji = data.kanji[question.char];
  if (question.type === 'word') {
    return `<p><span lang="ja" class="word">${esc(question.word.w)}</span> <span lang="ja" class="word-reading">${highlightReading(question.word)}</span> ${esc(question.word.m)}</p>`;
  }
  const on = kanji.on.map((g) => g.r).join('、');
  const kun = kanji.kun.filter((g) => g.words.length).map((g) => g.r + (g.okuri[0] ? `(${g.okuri[0]})` : '')).join('、');
  return `<p><span lang="ja" class="explain-kanji">${esc(question.char)}</span> ${esc(kanji.meanings.slice(0, 3).join(', '))}</p>
    <p class="explain-readings">${kun ? `<span>訓 <span lang="ja">${esc(kun)}</span></span>` : ''}${on ? `<span>音 <span lang="ja">${esc(on)}</span></span>` : ''}</p>`;
}

/**
 * Run a list of multiple-choice questions in `root`.
 * Wrong answers come back at the end until answered correctly; only first attempts are scored.
 */
export function runQuestions(root, { questions, data, title, onAnswer, onComplete }) {
  const queue = questions.map((question) => ({ question, first: true }));
  const total = questions.length;
  let answeredFirst = 0;
  let correctFirst = 0;
  const missed = [];
  let current = null;
  let answered = false;
  let timer = null;

  function show() {
    current = queue.shift();
    answered = false;
    if (!current) {
      onComplete({ total, correct: correctFirst, missed });
      return;
    }
    const { question } = current;
    root.innerHTML = `
      <div class="session">
        <div class="session-top">
          <p class="session-title">${esc(title)}</p>
          <p class="session-count">${current.first ? answeredFirst + 1 : 'Again'} <span>of ${total}</span></p>
        </div>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${answeredFirst}"><span style="width:${(answeredFirst / total) * 100}%"></span></div>
        <div class="question">
          <div class="prompt">${promptHtml(question)}</div>
          <p class="ask">${esc(question.ask)}</p>
          <div class="choices ${question.type === 'kanji' ? 'choices--kanji' : ''}">
            ${question.choices.map((choice, i) => `
              <button type="button" class="choice" data-index="${i}" ${question.type === 'kanji' || question.type === 'reading' || question.type === 'word' ? 'lang="ja"' : ''}>
                <span class="key" aria-hidden="true">${i + 1}</span><span class="choice-label">${esc(choice.label)}</span>
              </button>`).join('')}
          </div>
          <div class="feedback" aria-live="polite"></div>
        </div>
      </div>`;
    root.querySelector('.choice')?.focus({ preventScroll: true });
  }

  function choose(index) {
    if (answered || !current) return;
    const { question, first } = current;
    const choice = question.choices[index];
    if (!choice) return;
    answered = true;
    const correct = choice.correct;
    if (first) {
      answeredFirst += 1;
      if (correct) correctFirst += 1;
      else missed.push(question);
      onAnswer?.(question, correct);
    }
    if (!correct) queue.push({ question: { ...question, choices: [...question.choices].reverse() }, first: false });

    root.querySelectorAll('.choice').forEach((button, i) => {
      button.disabled = true;
      if (question.choices[i].correct) {
        button.classList.add('is-answer');
        button.insertAdjacentHTML('beforeend', CIRCLE);
      }
      if (i === index && !correct) button.classList.add('is-wrong');
    });
    const feedback = root.querySelector('.feedback');
    feedback.innerHTML = `
      <p class="verdict ${correct ? 'verdict--right' : 'verdict--wrong'}">${correct ? 'Correct' : `Not quite. The answer is <span lang="ja">${esc(question.answer)}</span>.`}</p>
      <div class="explain">${explainHtml(question, data)}</div>
      <button type="button" class="button button--primary next">Continue</button>`;
    if (correct) timer = setTimeout(show, AUTO_ADVANCE_MS);
    else {
      const next = feedback.querySelector('.next');
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function onClick(event) {
    const choice = event.target.closest('.choice');
    if (choice) choose(Number(choice.dataset.index));
    if (event.target.closest('.next')) {
      clearTimeout(timer);
      show();
    }
  }

  function onKey(event) {
    if (event.target.matches('input, textarea, select')) return;
    if (!answered && /^[1-9]$/.test(event.key)) choose(Number(event.key) - 1);
    else if (answered && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      clearTimeout(timer);
      show();
    }
  }

  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  show();
  return () => {
    clearTimeout(timer);
    root.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
  };
}

export function resultsHtml({ total, correct, missed }, data, heading) {
  const unique = [...new Set(missed.map((q) => q.char))];
  const score = total ? Math.round((correct / total) * 100) : 0;
  return `
    <div class="results">
      <h1>${esc(heading)}</h1>
      <p class="score"><strong>${correct}</strong> of ${total} right on the first try (${score}%).</p>
      ${unique.length ? `<h2>Look at these again</h2><ul class="missed">${unique.map((char) => `
        <li><a href="#/kanji/${encodeURIComponent(char)}"><span lang="ja" class="missed-kanji">${esc(char)}</span><span>${esc(data.kanji[char].meanings.slice(0, 2).join(', '))}</span></a></li>`).join('')}</ul>` : '<p>No mistakes this time.</p>'}
    </div>`;
}
