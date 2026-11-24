import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { STORAGE_KEY } from '../../js/config.js';
import { startCard } from '../../js/srs.js';
import { createStore, normalizeState, streakDays } from '../../js/store.js';
import { dayKey } from '../../js/util.js';
import { memoryStorage } from './fixture.mjs';

const NOW = new Date(2026, 10, 24, 9, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

describe('Progress store', () => {
  let storage;
  let store;
  beforeEach(() => {
    storage = memoryStorage();
    store = createStore(storage);
  });

  test('STO001 a saved card survives creating a new store on the same storage', () => {
    store.setCard('日', startCard(NOW));
    const reloaded = createStore(storage);
    assert.equal(reloaded.card('日').stage, 1);
  });

  test('STO002 a review updates the card and the day counters', () => {
    store.setCard('日', startCard(NOW));
    store.reviewed('日', { ...startCard(NOW), stage: 2 }, true, NOW);
    store.reviewed('日', { ...startCard(NOW), stage: 1 }, false, NOW);
    assert.deepEqual(store.state.days[dayKey(NOW)], { reviews: 2, correct: 1, learned: 0 });
    assert.equal(store.card('日').stage, 1);
  });

  test('STO003 learning a lesson adds every card and counts them', () => {
    store.learned({ 日: startCard(NOW), 木: startCard(NOW) }, NOW);
    assert.equal(Object.keys(store.state.cards).length, 2);
    assert.equal(store.state.days[dayKey(NOW)].learned, 2);
  });

  test('STO004 notes are saved and blank notes are removed', () => {
    store.setNote('休', 'leaning on a tree');
    assert.equal(store.note('休'), 'leaning on a tree');
    store.setNote('休', '   ');
    assert.equal(store.note('休'), '');
  });

  test('STO005 export then import restores the same progress', () => {
    store.setCard('木', startCard(NOW, 4));
    store.answered('木', false);
    const text = store.exportText();
    const other = createStore(memoryStorage());
    assert.equal(other.importText(text), 1);
    assert.equal(other.card('木').stage, 4);
    assert.deepEqual(other.state.answers.木, { right: 0, wrong: 1 });
  });

  test('STO006 importing a file that is not a progress file throws and keeps the current data', () => {
    store.setCard('日', startCard(NOW));
    assert.throws(() => store.importText('{"hello": 1}'), /not a Kanji Study progress file/);
    assert.throws(() => store.importText('not json'));
    assert.equal(store.card('日').stage, 1);
  });

  test('STO007 invalid cards are dropped when a state is normalized', () => {
    const state = normalizeState({ cards: { 日: { stage: 9, due: 1 }, 木: { stage: 2, due: 'x' }, 人: { stage: 3, due: 5 } } });
    assert.deepEqual(Object.keys(state.cards), ['人']);
  });

  test('STO008 reset clears progress but keeps settings', () => {
    store.setSetting('theme', 'dark');
    store.setCard('日', startCard(NOW));
    store.reset();
    assert.equal(store.card('日'), undefined);
    assert.equal(store.setting('theme'), 'dark');
  });

  test('STO009 a corrupt saved value falls back to an empty state', () => {
    storage.setItem(STORAGE_KEY, '{broken');
    const fresh = createStore(storage);
    assert.deepEqual(fresh.state.cards, {});
  });

  test('STO010 streak counts consecutive active days ending today or yesterday', () => {
    const days = {
      [dayKey(NOW - DAY)]: { reviews: 3, correct: 3, learned: 0 },
      [dayKey(NOW - 2 * DAY)]: { reviews: 0, correct: 0, learned: 5 },
      [dayKey(NOW - 4 * DAY)]: { reviews: 1, correct: 1, learned: 0 },
    };
    assert.equal(streakDays(days, NOW), 2);
    assert.equal(streakDays({}, NOW), 0);
  });
});
