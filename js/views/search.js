import { search } from '../data.js';
import { kanjiLink, levelBadge } from '../render.js';
import { esc } from '../util.js';

export function render(ctx, _params, query) {
  const { data, store, root } = ctx;
  const q = query.get('q') || '';
  const results = search(data, q);
  const parts = [...q].filter((ch) => !data.isStudy(ch) && data.children.has(ch));
  const input = document.querySelector('[data-search] input');
  if (input && input.value !== q) input.value = q;

  root.innerHTML = `
    <header class="page-head">
      <h1>Search${q ? `: <span lang="ja">${esc(q)}</span>` : ''}</h1>
      <p>Search by kanji, English meaning, or reading in hiragana or katakana.</p>
    </header>
    ${parts.map((p) => `<p><a href="#/family/${encodeURIComponent(p)}">See the <span lang="ja">${esc(p)}</span> family</a> (it is a part, not one of the N5–N2 kanji)</p>`).join('')}
    ${results.length ? `<ul class="search-results">${results.map((char) => {
      const kanji = data.kanji[char];
      const readings = [...kanji.kun.map((g) => g.r), ...kanji.on.map((g) => g.r)].slice(0, 4).join('、');
      return `<li>${kanjiLink(char, data, store, 'm')}<div><p>${esc(kanji.meanings.slice(0, 3).join(', '))}</p><p class="hint"><span lang="ja">${esc(readings)}</span> ${levelBadge(kanji.level)}</p></div></li>`;
    }).join('')}</ul>` : q ? `<p class="empty">No kanji match “${esc(q)}”. Try a shorter word, or type the reading in kana.</p>` : ''}`;
}
