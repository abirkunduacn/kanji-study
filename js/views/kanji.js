import { KNOWN_STAGE } from '../config.js';
import { lessonOf } from '../data.js';
import { kanjiLink, masu, metaLine, partsFormula, readingsBlock, storyHtml } from '../render.js';
import { stageGroup, startCard } from '../srs.js';
import { esc, relativeTime } from '../util.js';

function statusBox(char, ctx) {
  const card = ctx.store.card(char);
  if (!card) {
    return `<div class="status">
      <p><strong>Not started.</strong> Add it to your reviews, or mark it known to review it less often.</p>
      <div class="actions">
        <button class="button button--primary" data-action="add">Add to reviews</button>
        <button class="button button--quiet" data-action="known">I already know it</button>
      </div>
    </div>`;
  }
  return `<div class="status">
    <p><span class="swatch stage-${stageGroup(card).id}" aria-hidden="true"></span><strong>${stageGroup(card).label}</strong> (stage ${card.stage} of 8). Next review ${relativeTime(card.due, ctx.now())}.</p>
    <div class="actions"><button class="button button--quiet" data-action="reset">Remove from reviews</button></div>
  </div>`;
}

function familySection(char, ctx) {
  const { data, store } = ctx;
  const children = (data.children.get(char) || []).filter((c) => data.isStudy(c));
  const used = children.length
    ? `<div><h3>Appears in</h3><div class="chip-row">${children.map((c) => kanjiLink(c, data, store, 'm')).join('')}</div></div>`
    : '';
  const sizeNote = data.familySize(char) > children.length ? `<a href="#/family/${encodeURIComponent(char)}">See the whole ${esc(char)} family (${data.familySize(char)} kanji)</a>` : '';
  if (!used && !sizeNote) return '';
  return `<section class="panel family-panel"><h2>Family</h2>${used}${sizeNote ? `<p>${sizeNote}</p>` : ''}</section>`;
}

export function render(ctx, [rawChar]) {
  const { data, store } = ctx;
  const char = decodeURIComponent(rawChar);
  const kanji = data.kanji[char];
  if (!kanji) {
    ctx.root.innerHTML = `<div class="empty"><p class="empty-title"><span lang="ja">${esc(char)}</span> is not in the N5–N2 list.</p><p><a href="#/family/${encodeURIComponent(char)}">See kanji that use it as a part</a></p></div>`;
    return undefined;
  }
  const index = data.position.get(char);
  const prev = data.order[index - 1];
  const next = data.order[index + 1];
  const lesson = lessonOf(data, char);

  ctx.root.innerHTML = `
    <article class="kanji-page">
      <header class="kanji-head">
        ${masu(char, 'xl')}
        <div>
          <h1 class="meanings meanings--big">${esc(kanji.meanings.join(', '))}</h1>
          ${metaLine(kanji)}
          <div class="status-wrap">${statusBox(char, ctx)}</div>
        </div>
      </header>

      <section class="panel memory">
        <h2>Remember it</h2>
        ${partsFormula(char, data) || '<p class="hint">A basic shape with no smaller parts.</p>'}
        ${kanji.story ? `<p class="story">${storyHtml(kanji.story)}</p>` : ''}
        <label class="note-label" for="note">My memory note</label>
        <textarea id="note" rows="2" placeholder="Write your own story or a hint that works for you.">${esc(store.note(char))}</textarea>
        <p class="note-saved" aria-live="polite"></p>
      </section>

      <section class="panel">
        <h2>Readings and common words</h2>
        ${readingsBlock(kanji)}
      </section>

      ${familySection(char, ctx)}

      <section class="panel">
        <h2>${kanji.level} lesson ${kanji.lesson}</h2>
        <div class="chip-row">${lesson.map((c) => kanjiLink(c, data, store, 'm')).join('')}</div>
      </section>

      <nav class="pager" aria-label="Next and previous kanji">
        ${prev ? `<a href="#/kanji/${encodeURIComponent(prev)}" rel="prev"><span>Previous</span> <span lang="ja">${esc(prev)}</span></a>` : '<span></span>'}
        ${next ? `<a href="#/kanji/${encodeURIComponent(next)}" rel="next"><span>Next</span> <span lang="ja">${esc(next)}</span></a>` : '<span></span>'}
      </nav>
    </article>`;

  const statusWrap = ctx.root.querySelector('.status-wrap');
  statusWrap.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'add') store.setCard(char, startCard(ctx.now()));
    if (action === 'known') store.setCard(char, startCard(ctx.now(), KNOWN_STAGE));
    if (action === 'reset' && window.confirm(`Remove ${char} from your reviews? Its review history will be cleared.`)) store.removeCard(char);
    statusWrap.innerHTML = statusBox(char, ctx);
    ctx.refreshBadge();
  });

  const note = ctx.root.querySelector('#note');
  const saved = ctx.root.querySelector('.note-saved');
  let timer = null;
  note.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      store.setNote(char, note.value);
      saved.textContent = 'Note saved';
    }, 500);
  });

  const onKey = (event) => {
    if (event.target.matches('input, textarea, select')) return;
    if (event.key === 'ArrowLeft' && prev) window.location.hash = `#/kanji/${encodeURIComponent(prev)}`;
    if (event.key === 'ArrowRight' && next) window.location.hash = `#/kanji/${encodeURIComponent(next)}`;
  };
  document.addEventListener('keydown', onKey);
  return () => {
    clearTimeout(timer);
    if (note.value !== store.note(char)) store.setNote(char, note.value);
    document.removeEventListener('keydown', onKey);
  };
}
