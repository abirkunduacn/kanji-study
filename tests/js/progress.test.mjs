import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { ACTIVE_USER_KEY, STORAGE_KEY } from '../../js/config.js';
import { createStore, emptyState, mergeStates, normalizeState, rescueKey, userKey } from '../../js/store.js';
import { memoryStorage } from './fixture.mjs';

// Progress exactly as version 2026.11.24 saves it. Never edit the file to make a test pass:
// a failure here means the change would lose existing users' progress, so add a migration instead.
const SAVED_TEXT = readFileSync(new URL('./saved-progress-2026-11.json', import.meta.url), 'utf8');
const SAVED = JSON.parse(SAVED_TEXT);
const progressOf = ({ cards, notes, answers, days, settings, removed }) => ({ cards, notes, answers, days, settings, removed });

function storageWith(key, text) {
  const storage = memoryStorage();
  storage.setItem(key, text);
  return storage;
}

describe('Progress across updates', () => {
  test('PRG001 the keys progress is saved under never change, so a new version finds it', () => {
    assert.equal(STORAGE_KEY, 'kanjiStudy.v1');
    assert.equal(userKey('u1'), 'kanjiStudy.v1:u1');
    assert.equal(ACTIVE_USER_KEY, 'kanjiStudy.activeUser');
  });

  test('PRG002 progress saved by an earlier version loads with every card, note, tally, day and setting', () => {
    for (const key of [STORAGE_KEY, userKey('u1')]) {
      const store = createStore(storageWith(key, SAVED_TEXT), key);
      assert.deepEqual(progressOf(store.state), progressOf(SAVED), key);
      assert.equal(store.rescue(), null, 'nothing needed keeping');
    }
  });

  test('PRG003 saving in the new version keeps all of the earlier progress, including kanji no longer in the list', () => {
    const storage = storageWith(STORAGE_KEY, SAVED_TEXT);
    createStore(storage).setSetting('theme', 'light');
    const resaved = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.deepEqual(resaved.cards, SAVED.cards);
    assert.deepEqual(resaved.notes, SAVED.notes);
    assert.ok(resaved.cards['丼'], 'a card for a kanji outside N5–N2 is kept');
  });

  test('PRG004 a progress file downloaded from an earlier version restores in full', () => {
    const file = JSON.stringify({ app: 'kanji-study', exported: '2026-11-24T09:00:00.000Z', ...SAVED });
    const store = createStore(memoryStorage());
    assert.equal(store.importText(file), Object.keys(SAVED.cards).length);
    assert.deepEqual(progressOf(store.state), progressOf(SAVED));
  });

  test('PRG005 the cloud copy from an earlier version arrives whole on a new device', () => {
    const merged = mergeStates(emptyState(), normalizeState(JSON.parse(SAVED_TEXT)));
    assert.deepEqual(progressOf(merged), progressOf(SAVED));
  });

  test('PRG006 progress an update cannot read is kept untouched before the app saves over it', () => {
    const broken = '{"cards": {"日": {"stage": 2';
    const storage = storageWith(STORAGE_KEY, broken);
    const store = createStore(storage);
    assert.deepEqual(store.state.cards, {});
    store.setSetting('theme', 'dark');
    assert.notEqual(storage.getItem(STORAGE_KEY), broken, 'the app has saved over the original');
    assert.equal(storage.getItem(rescueKey(STORAGE_KEY)), broken);
    assert.equal(store.rescue(), broken);
  });

  test('PRG007 when only some kanji cannot be read, the rest load and the original is kept', () => {
    const changed = JSON.parse(SAVED_TEXT);
    changed.cards['日'].stage = 99;
    const text = JSON.stringify(changed);
    const store = createStore(storageWith(STORAGE_KEY, text));
    assert.equal(store.card('日'), undefined);
    assert.deepEqual(store.card('人'), SAVED.cards['人']);
    assert.equal(store.rescue(), text);
  });

  test('PRG008 an earlier kept copy is never replaced, and deleting it removes only the copy', () => {
    const storage = storageWith(STORAGE_KEY, 'not json');
    storage.setItem(rescueKey(STORAGE_KEY), 'first copy');
    const store = createStore(storage);
    assert.equal(store.rescue(), 'first copy');
    store.clearRescue();
    assert.equal(store.rescue(), null);
    assert.equal(storage.getItem(STORAGE_KEY), 'not json', 'the saved progress itself is untouched');
  });
});
