import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { kanjiSheet, storyHtml } from '../../js/render.js';
import { durationLabel, esc, kataToHira, makeRng, parseHash, relativeTime, shuffle } from '../../js/util.js';
import { fixtureData } from './fixture.mjs';

const HOUR = 3600 * 1000;

describe('Utilities', () => {
  test('UTL001 esc makes text safe to put in HTML', () => {
    assert.equal(esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    assert.equal(esc(undefined), '');
  });

  test('UTL002 katakana is converted to hiragana', () => {
    assert.equal(kataToHira('キュウ'), 'きゅう');
    assert.equal(kataToHira('やすむ'), 'やすむ');
  });

  test('UTL003 hashes split into path, query and an optional anchor', () => {
    const parsed = parseHash('#/level/N5#lesson-3');
    assert.equal(parsed.path, '/level/N5');
    assert.equal(parsed.anchor, 'lesson-3');
    const quick = parseHash('#/quick/N4?lesson=2&hide=1');
    assert.equal(quick.path, '/quick/N4');
    assert.equal(quick.query.get('lesson'), '2');
    assert.equal(parseHash('').path, '/');
  });

  test('UTL004 relative times read naturally', () => {
    assert.equal(relativeTime(0, 10), 'now');
    assert.equal(relativeTime(3 * HOUR, 0), 'in 3 hours');
    assert.equal(relativeTime(2 * 24 * HOUR, 0), 'in 2 days');
    assert.equal(durationLabel(4), '4 hours');
    assert.equal(durationLabel(72), '3 days');
  });

  test('UTL005 shuffling with the same seed is repeatable and keeps every item', () => {
    const a = shuffle([1, 2, 3, 4, 5], makeRng(42));
    const b = shuffle([1, 2, 3, 4, 5], makeRng(42));
    assert.deepEqual(a, b);
    assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5]);
  });
});

describe('Rendering', () => {
  const data = fixtureData();

  test('RND001 stories bold the **marked** words and escape everything else', () => {
    assert.equal(storyHtml('A **person** <rests>'), 'A <strong>person</strong> &lt;rests&gt;');
  });

  test('RND002 a study sheet shows kun and on readings, words and the story', () => {
    const html = kanjiSheet('休', data);
    for (const text of ['やす', 'きゅう', '休日', 'to rest', '<strong>person</strong>', '亻']) assert.ok(html.includes(text), text);
    assert.ok(html.includes('<mark>きゅう</mark>じつ'), 'highlights the reading of 休 inside the word');
  });

  test('RND003 a hidden sheet gets a reveal button', () => {
    assert.ok(kanjiSheet('休', data, { hidden: true }).includes('class="reveal"'));
  });

  test('RND004 readings without common words are listed as less common, for on and kun alike', () => {
    const people = kanjiSheet('人', data);
    assert.ok(people.includes('Less common: <span lang="ja">にん</span>'));
    assert.ok(kanjiSheet('本', data).includes('Less common: <span lang="ja">もと</span>'));
  });
});
