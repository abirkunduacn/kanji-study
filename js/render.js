import { LEVELS } from './config.js';
import { kunText } from './data.js';
import { stageGroup } from './srs.js';
import { esc, plural } from './util.js';

export function masu(char, size = 'l', extra = '') {
  return `<span class="masu masu--${size} ${extra}" lang="ja">${esc(char)}</span>`;
}

export function kanjiLink(char, data, store, size = 's') {
  const kanji = data.kanji[char];
  const stage = stageGroup(store.card(char)).id;
  const title = kanji ? `${char} — ${kanji.meanings[0]}` : char;
  return `<a class="chip chip--${size} stage-${stage}" href="#/kanji/${encodeURIComponent(char)}" lang="ja" title="${esc(title)}">${esc(char)}</a>`;
}

export function levelBadge(level) {
  return `<span class="level level--${esc(level.toLowerCase())}">${esc(level)}</span>`;
}

export function storyHtml(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function highlightReading(word) {
  if (!word.s) return esc(word.r);
  const [start, end] = word.s;
  return `${esc(word.r.slice(0, start))}<mark>${esc(word.r.slice(start, end))}</mark>${esc(word.r.slice(end))}`;
}

export function wordList(words) {
  if (!words.length) return '';
  return `<ul class="words">${words.map((word) => `
    <li>
      <span class="word" lang="ja">${esc(word.w)}</span>
      <span class="word-reading" lang="ja">${highlightReading(word)}</span>
      <span class="word-meaning">${esc(word.m)}</span>
    </li>`).join('')}</ul>`;
}

function kunLabel(group) {
  if (!group.okuri.length) return `<span class="reading" lang="ja">${esc(group.r)}</span>`;
  return group.okuri.map((okuri) => `<span class="reading" lang="ja">${esc(group.r)}<span class="okuri">${esc(okuri)}</span></span>`).join('');
}

function readingRows(groups, kind) {
  const main = groups.filter((group) => group.words.length);
  const rare = groups.filter((group) => !group.words.length);
  const rows = main.map((group) => `
    <div class="reading-row">
      <div class="reading-set">${kind === 'kun' ? kunLabel(group) : `<span class="reading" lang="ja">${esc(group.r)}</span>`}</div>
      ${wordList(group.words)}
    </div>`).join('');
  const rareRow = rare.length
    ? `<p class="rare-readings">Less common: <span lang="ja">${rare.map((g) => esc(g.okuri?.length ? kunText(g, g.okuri[0]) : g.r)).join('、')}</span></p>`
    : '';
  return rows + rareRow;
}

export function readingsBlock(kanji) {
  const kun = kanji.kun.length ? `
    <section class="readings readings--kun" aria-label="Kun'yomi">
      <h3><span lang="ja">訓</span> Kun’yomi <span class="hint">native Japanese reading</span></h3>
      ${readingRows(kanji.kun, 'kun')}
    </section>` : '';
  const on = kanji.on.length ? `
    <section class="readings readings--on" aria-label="On'yomi">
      <h3><span lang="ja">音</span> On’yomi <span class="hint">reading from Chinese</span></h3>
      ${readingRows(kanji.on, 'on')}
    </section>` : '';
  const special = kanji.special?.length ? `
    <section class="readings readings--special" aria-label="Special readings">
      <h3><span lang="ja">特</span> Special readings</h3>
      ${wordList(kanji.special)}
    </section>` : '';
  return kun + on + special;
}

export function partsFormula(char, data) {
  const kanji = data.kanji[char];
  if (!kanji.parts.length) return '';
  const parts = kanji.parts.map((part) => {
    const target = data.isStudy(part.c) ? `#/kanji/${encodeURIComponent(part.c)}` : `#/family/${encodeURIComponent(part.base || part.c)}`;
    const base = part.base && part.base !== part.c ? `<span class="part-base">from <span lang="ja">${esc(part.base)}</span></span>` : '';
    const sound = part.sound
      ? `<span class="part-sound">sound hint${part.sr ? ` <span class="part-sound-reading" lang="ja">${esc(part.sr)}</span>` : ''}</span>`
      : '';
    return `<a class="part" href="${target}"><span class="part-char" lang="ja">${esc(part.c)}</span><span class="part-meaning">${esc(part.m || 'shape')}</span>${base}${sound}</a>`;
  }).join('<span class="plus" aria-hidden="true">+</span>');
  return `<div class="formula">${parts}<span class="equals" aria-hidden="true">=</span><span class="part part--result"><span class="part-char" lang="ja">${esc(char)}</span><span class="part-meaning">${esc(kanji.meanings[0])}</span></span></div>`;
}

export function radicalLine(kanji) {
  const radical = kanji.radical;
  if (!radical) return '';
  const form = radical.form && radical.form !== radical.char ? ` <span lang="ja">${esc(radical.form)}</span>` : '';
  return `<span class="radical">Radical <span lang="ja">${esc(radical.char)}</span>${form} ${esc(radical.name)} <span class="hint">#${radical.num}</span></span>`;
}

export function metaLine(kanji) {
  return `<div class="meta">${levelBadge(kanji.level)}<a href="#/level/${kanji.level}#lesson-${kanji.lesson}">Lesson ${kanji.lesson}</a><span>${plural(kanji.strokes, 'stroke')}</span>${radicalLine(kanji)}</div>`;
}

// The full study sheet for one kanji, used by Quick review, lessons and flashcards.
export function kanjiSheet(char, data, { hidden = false, link = true } = {}) {
  const kanji = data.kanji[char];
  const big = link ? `<a href="#/kanji/${encodeURIComponent(char)}" class="sheet-kanji" aria-label="Open ${esc(char)}">${masu(char, 'l')}</a>` : `<div class="sheet-kanji">${masu(char, 'l')}</div>`;
  const story = kanji.story ? `<p class="story">${storyHtml(kanji.story)}</p>` : '';
  return `
  <article class="sheet ${hidden ? 'is-hidden' : ''}" data-char="${esc(char)}">
    <div class="sheet-head">
      ${big}
      <div class="sheet-title">
        <p class="meanings">${esc(kanji.meanings.join(', '))}</p>
        ${metaLine(kanji)}
        ${partsFormula(char, data)}
      </div>
    </div>
    <div class="sheet-body">
      ${readingsBlock(kanji)}
      ${story}
    </div>
    ${hidden ? '<button class="reveal" type="button">Show readings and meaning</button>' : ''}
  </article>`;
}

export function stageLegend(groups) {
  return `<ul class="legend">${groups.map((group) => `<li><span class="swatch stage-${group.id}" aria-hidden="true"></span>${esc(group.label)}</li>`).join('')}</ul>`;
}

export function progressCells(chars, data, store) {
  return `<div class="cells" role="list">${chars.map((char) => {
    const group = stageGroup(store.card(char));
    return `<a role="listitem" class="cell stage-${group.id}" href="#/kanji/${encodeURIComponent(char)}" title="${esc(`${char} ${data.kanji[char].meanings[0]} — ${group.label}`)}"><span class="sr-only">${esc(char)} ${esc(group.label)}</span></a>`;
  }).join('')}</div>`;
}

export function levelTabs(active, hrefFor) {
  return `<nav class="tabs" aria-label="JLPT level">${LEVELS.map((level) => `<a href="${hrefFor(level)}" class="${level === active ? 'is-active' : ''}" ${level === active ? 'aria-current="page"' : ''}>${level}</a>`).join('')}</nav>`;
}

export function emptyState(title, text, actions = '') {
  return `<div class="empty"><p class="empty-title">${esc(title)}</p><p>${esc(text)}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
