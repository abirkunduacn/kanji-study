import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { createScrollMemory } from '../../js/scroll-memory.js';
import { parseHash } from '../../js/util.js';
import { lessonHash, stepFromQuery } from '../../js/views/learn.js';

function fakeHistory() {
  const entries = [{ state: null }];
  let index = 0;
  return {
    get state() { return entries[index].state; },
    replaceState(state) { entries[index].state = state; },
    open() { entries.splice(index + 1); entries.push({ state: null }); index += 1; },
    back() { index -= 1; },
    forward() { index += 1; },
  };
}

describe('Scroll memory', () => {
  let history;
  let scroll;
  let memory;

  beforeEach(() => {
    history = fakeHistory();
    scroll = 0;
    let count = 0;
    memory = createScrollMemory({ history, getScroll: () => scroll, makeId: () => `entry-${(count += 1)}` });
  });

  test('NAV001 a page opened fresh has nothing to restore and gets an id on its history entry', () => {
    assert.equal(memory.enter(), null);
    assert.equal(history.state.scrollId, 'entry-1');
  });

  test('NAV002 Back and Forward return to where each page was scrolled', () => {
    memory.enter();
    scroll = 420;
    history.open();
    assert.equal(memory.enter(), null, 'the kanji page opens at the top');
    scroll = 130;
    history.back();
    assert.equal(memory.enter(), 420, 'Back returns to the lesson card position');
    history.forward();
    assert.equal(memory.enter(), 130, 'Forward returns to the kanji page position');
  });

  test('NAV003 the id is added next to whatever state the entry already holds', () => {
    history.replaceState({ other: 1 });
    memory.enter();
    assert.deepEqual(history.state, { other: 1, scrollId: 'entry-1' });
  });
});

describe('Lesson address', () => {
  test('LSN001 the address names the card (counting from 1) or the results', () => {
    assert.equal(lessonHash('N5', 3), '#/learn/N5/3');
    assert.equal(lessonHash('N5', 3, 0), '#/learn/N5/3?step=1');
    assert.equal(lessonHash('N4', 2, 9), '#/learn/N4/2?step=10');
    assert.equal(lessonHash('N5', 3, 'done'), '#/learn/N5/3?step=done');
  });

  test('LSN002 a saved step is read back as the same card or the results', () => {
    const read = (hash) => stepFromQuery(parseHash(hash).query, 10);
    assert.equal(read(lessonHash('N5', 3, 4)), 4);
    assert.equal(read(lessonHash('N5', 3, 'done')), 'done');
    assert.equal(read(lessonHash('N5', 3)), null);
  });

  test('LSN003 a step outside the lesson or not a number falls back to the intro', () => {
    for (const value of ['0', '11', '2.5', 'abc', '']) {
      assert.equal(stepFromQuery(new URLSearchParams({ step: value }), 10), null, value);
    }
    assert.equal(stepFromQuery(undefined, 10), null);
  });
});
