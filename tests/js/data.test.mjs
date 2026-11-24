import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { familyMembers, familyRoots, lessonOf, loadData, readingsOf, search } from '../../js/data.js';
import { fixtureData, fixtureRaw } from './fixture.mjs';

describe('Kanji data index', () => {
  const data = fixtureData();

  test('DAT001 kanji are ordered by level then lesson', () => {
    assert.deepEqual(data.order, ['日', '木', '人', '休', '本', '林', '森']);
    assert.equal(data.position.get('森'), 6);
  });

  test('DAT002 a part links to its full form, so 休 is in the 人 family', () => {
    assert.deepEqual(data.partsOf('休'), ['亻', '人', '木']);
    assert.ok(data.children.get('人').includes('休'));
  });

  test('DAT003 the family of 木 includes kanji that contain it through another kanji', () => {
    assert.deepEqual([...familyMembers(data, '木')].sort(), ['休', '本', '林', '森'].sort());
    assert.equal(data.familySize('林'), 1);
  });

  test('DAT004 family roots are sorted by size and filtered by a minimum', () => {
    const roots = familyRoots(data, 2, 10);
    assert.equal(roots[0].char, '木');
    assert.ok(roots.every((root) => root.size >= 2));
  });

  test('DAT005 search finds kanji by character, meaning and reading, including katakana input', () => {
    assert.deepEqual(search(data, '休'), ['休']);
    assert.deepEqual(search(data, 'forest'), ['森']);
    assert.deepEqual(search(data, 'やすむ'), ['休']);
    assert.deepEqual(search(data, 'キュウ'), ['休']);
    assert.deepEqual(search(data, '  '), []);
  });

  test('DAT006 readings include kun stems with each okurigana', () => {
    const readings = readingsOf(data.kanji.休);
    assert.ok(readings.has('きゅう') && readings.has('やす') && readings.has('やすむ') && readings.has('やすまる'));
  });

  test('DAT007 lessonOf returns the lesson a kanji belongs to', () => {
    assert.deepEqual(lessonOf(data, '本'), ['休', '本', '林']);
  });

  test('DAT008 loadData reports an HTTP error clearly', async () => {
    await assert.rejects(loadData(async () => ({ ok: false, status: 404 })), /HTTP 404/);
    const loaded = await loadData(async () => ({ ok: true, json: async () => fixtureRaw() }));
    assert.equal(loaded.order.length, 7);
  });
});
