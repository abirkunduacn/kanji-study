import { FORECAST_DAYS, LEVELS, NEW_GROUP, STAGE_GROUPS, WEAK_LIST_LIMIT } from '../config.js';
import { kanjiLink, progressCells, stageLegend } from '../render.js';
import { forecast, stageCounts } from '../srs.js';
import { streakDays } from '../store.js';
import { esc, plural } from '../util.js';

const GROUPS = [NEW_GROUP, ...STAGE_GROUPS];

function forecastChart(cards, now) {
  const days = forecast(cards, now, FORECAST_DAYS);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const busiest = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
  const name = (d, i) => (i === 0 ? 'Today' : new Date(d.start).toLocaleDateString(undefined, { weekday: 'short' }));
  const full = (d, i) => (i === 0 ? 'Today, including overdue' : new Date(d.start).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }));
  return `
    <figure class="forecast">
      <figcaption>${total ? `${plural(total, 'review')} in the next ${FORECAST_DAYS} days. Busiest: ${name(busiest, days.indexOf(busiest))} with ${busiest.count}.` : `No reviews due in the next ${FORECAST_DAYS} days.`}</figcaption>
      <div class="bars" role="img" aria-label="Reviews due per day">
        ${days.map((d, i) => `
          <div class="bar-col" tabindex="0" data-tip="${esc(`${full(d, i)}: ${plural(d.count, 'review')}`)}">
            <div class="bar-track"><span class="bar" style="height:${(d.count / max) * 100}%"></span></div>
            <span class="bar-label">${esc(name(d, i))}</span>
          </div>`).join('')}
      </div>
      <p class="bar-tip" aria-live="polite"></p>
      <table class="sr-only"><caption>Reviews due per day</caption><tbody>${days.map((d, i) => `<tr><th>${esc(full(d, i))}</th><td>${d.count}</td></tr>`).join('')}</tbody></table>
    </figure>`;
}

function weakList(ctx) {
  const { data, store } = ctx;
  const scored = data.order.map((char) => {
    const tally = store.state.answers[char] || { right: 0, wrong: 0 };
    return { char, score: (store.card(char)?.lapses || 0) * 2 + tally.wrong - tally.right / 2 };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, WEAK_LIST_LIMIT);
  if (!scored.length) return '<p>Kanji you miss in reviews and quizzes will be listed here.</p>';
  return `<ul class="weak">${scored.map(({ char }) => `<li>${kanjiLink(char, data, store, 'm')}<span>${esc(data.kanji[char].meanings.slice(0, 2).join(', '))}</span></li>`).join('')}</ul>`;
}

export function render(ctx) {
  const { data, store, root } = ctx;
  const now = ctx.now();
  const cards = store.state.cards;
  const all = stageCounts(data.order, cards);
  const days = Object.values(store.state.days);
  const reviews = days.reduce((sum, d) => sum + d.reviews, 0);
  const correct = days.reduce((sum, d) => sum + d.correct, 0);
  const started = data.order.length - all.new;

  root.innerHTML = `
    <header class="page-head">
      <h1>Progress</h1>
    </header>
    <dl class="totals">
      <div><dt>Started</dt><dd>${started} <span>of ${data.order.length}</span></dd></div>
      <div><dt>Mastered</dt><dd>${all.mastered}</dd></div>
      <div><dt>Reviews done</dt><dd>${reviews}</dd></div>
      <div><dt>Review accuracy</dt><dd>${reviews ? `${Math.round((correct / reviews) * 100)}%` : '–'}</dd></div>
      <div><dt>Days in a row</dt><dd>${streakDays(store.state.days, now)}</dd></div>
    </dl>
    <section class="panel">
      <h2>Upcoming reviews</h2>
      ${forecastChart(cards, now)}
    </section>
    <section class="panel">
      <div class="section-head"><h2>By level</h2>${stageLegend(GROUPS)}</div>
      ${LEVELS.map((level) => {
        const chars = data.byLevel[level].chars;
        const counts = stageCounts(chars, cards);
        return `<div class="level-stat">
          <h3><a href="#/level/${level}">${level}</a></h3>
          <p class="level-stat-counts">${GROUPS.map((g) => `<span>${esc(g.label)} ${counts[g.id]}</span>`).join('')}</p>
          ${progressCells(chars, data, store)}
        </div>`;
      }).join('')}
    </section>
    <section class="panel">
      <h2>Often missed</h2>
      ${weakList(ctx)}
    </section>`;

  const tip = root.querySelector('.bar-tip');
  const showTip = (event) => {
    const col = event.target.closest('.bar-col');
    if (col) tip.textContent = col.dataset.tip;
  };
  root.querySelector('.bars').addEventListener('pointerover', showTip);
  root.querySelector('.bars').addEventListener('focusin', showTip);
}
