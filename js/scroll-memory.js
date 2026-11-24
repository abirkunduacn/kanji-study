const LOAD_PREFIX = Date.now().toString(36);
let idCount = 0;

function newId() {
  idCount += 1;
  return `${LOAD_PREFIX}-${idCount}`;
}

/**
 * Remembers how far each history entry was scrolled, so Back lands on the same spot.
 * Call enter() as a page starts to render: it returns the position to restore, or null for a page opened fresh.
 */
export function createScrollMemory({ history, getScroll, makeId = newId }) {
  const saved = new Map();
  let current = null;
  return {
    enter() {
      if (current !== null) saved.set(current, getScroll());
      let id = history.state?.scrollId;
      if (!id) {
        id = makeId();
        history.replaceState({ ...history.state, scrollId: id }, '');
      }
      current = id;
      return saved.has(id) ? saved.get(id) : null;
    },
  };
}
