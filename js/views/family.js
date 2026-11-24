import { FAMILY_INDEX_LIMIT, FAMILY_MIN_MEMBERS } from '../config.js';
import { familyRoots } from '../data.js';
import { kanjiLink, levelBadge, masu } from '../render.js';
import { esc } from '../util.js';

function nodeHtml(char, ctx) {
  const { data, store } = ctx;
  const kids = data.children.get(char) || [];
  const size = data.familySize(char);
  const label = data.isStudy(char)
    ? `${kanjiLink(char, data, store, 'm')}<span class="node-meaning">${esc(data.meaningOf(char))}</span>${levelBadge(data.kanji[char].level)}`
    : `<a class="chip chip--m chip--part" href="#/family/${encodeURIComponent(char)}" lang="ja">${esc(char)}</a><span class="node-meaning">${esc(data.meaningOf(char) || 'part')}</span>`;
  if (!kids.length) return `<li class="node"><div class="node-row">${label}</div></li>`;
  return `<li class="node"><details data-char="${esc(char)}"><summary><span class="node-row">${label}</span><span class="node-count">${size ? `${size} more` : ''}</span></summary><ul class="tree"></ul></details></li>`;
}

function indexView(ctx) {
  const roots = familyRoots(ctx.data, FAMILY_MIN_MEMBERS, FAMILY_INDEX_LIMIT);
  ctx.root.innerHTML = `
    <header class="page-head">
      <h1>Family map</h1>
      <p>Most kanji are built from smaller parts. Pick a part to see every N5–N2 kanji that grows out of it, then open each branch to go deeper.</p>
      <form class="inline-search" data-family-search><label for="family-q">Jump to a kanji or part</label><input id="family-q" name="q" lang="ja" placeholder="木" maxlength="2"><button class="button" type="submit">Show family</button></form>
    </header>
    <ul class="family-grid">
      ${roots.map(({ char, size }) => `<li><a href="#/family/${encodeURIComponent(char)}">${masu(char, 's')}<span class="family-meaning">${esc(ctx.data.meaningOf(char) || 'part')}</span><span class="family-size">${size} kanji</span></a></li>`).join('')}
    </ul>`;
  ctx.root.querySelector('[data-family-search]').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = new FormData(event.target).get('q').trim();
    if (value) window.location.hash = `#/family/${encodeURIComponent([...value][0])}`;
  });
}

function treeView(ctx, char) {
  const { data } = ctx;
  const kids = data.children.get(char) || [];
  const parts = data.partsOf(char);
  ctx.root.innerHTML = `
    <p class="crumbs"><a href="#/family">Family map</a></p>
    <header class="family-head">
      ${masu(char, 'xl')}
      <div>
        <h1>${esc(data.meaningOf(char) || 'Part')} family</h1>
        <p>${data.familySize(char)} N5–N2 kanji contain <span lang="ja">${esc(char)}</span>.${data.isStudy(char) ? ` <a href="#/kanji/${encodeURIComponent(char)}">Open <span lang="ja">${esc(char)}</span></a>` : ''}</p>
        ${parts.length ? `<p class="hint">Itself built from ${parts.map((p) => `<a href="#/family/${encodeURIComponent(p)}" lang="ja">${esc(p)}</a>`).join(' + ')}</p>` : ''}
      </div>
    </header>
    ${kids.length ? `<ul class="tree tree--root">${kids.map((kid) => nodeHtml(kid, ctx)).join('')}</ul>` : '<p class="empty">No N5–N2 kanji use this as a part.</p>'}`;

  const onToggle = (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open) return;
    const list = details.querySelector(':scope > ul');
    if (list.childElementCount) return;
    list.innerHTML = (data.children.get(details.dataset.char) || []).map((kid) => nodeHtml(kid, ctx)).join('');
  };
  ctx.root.addEventListener('toggle', onToggle, true);
  return () => ctx.root.removeEventListener('toggle', onToggle, true);
}

export function render(ctx, [rawChar]) {
  if (!rawChar) return indexView(ctx);
  return treeView(ctx, decodeURIComponent(rawChar));
}
