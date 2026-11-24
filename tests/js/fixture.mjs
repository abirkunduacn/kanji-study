import { indexData } from '../../js/data.js';

const word = (w, r, m, s) => ({ w, r, m, lv: 'N5', ...(s ? { s } : {}) });
const kanji = (level, lesson, meanings, parts, on, kun, extra = {}) => ({ level, lesson, strokes: 4, meanings, radical: null, parts, on, kun, ...extra });

export function fixtureRaw() {
  return {
    built: '2026-11-24',
    levels: {
      N5: { count: 6, lessons: [['日', '木', '人'], ['休', '本', '林']] },
      N4: { count: 1, lessons: [['森']] },
      N3: { count: 0, lessons: [] },
      N2: { count: 0, lessons: [] },
    },
    kanji: {
      日: kanji('N5', 1, ['day', 'sun'], [],
        [{ r: 'にち', words: [word('毎日', 'まいにち', 'every day', [2, 4])] }, { r: 'じつ', words: [word('休日', 'きゅうじつ', 'holiday', [3, 5])] }],
        [{ r: 'ひ', okuri: [], words: [word('日', 'ひ', 'day', [0, 1])] }], { special: [word('今日', 'きょう', 'today')] }),
      木: kanji('N5', 1, ['tree', 'wood'], [],
        [{ r: 'もく', words: [word('木曜', 'もくよう', 'Thursday', [0, 2])] }],
        [{ r: 'き', okuri: [], words: [word('木', 'き', 'tree', [0, 1])] }]),
      人: kanji('N5', 1, ['person'], [],
        [{ r: 'じん', words: [word('外人', 'がいじん', 'foreigner', [2, 4])] }, { r: 'にん', words: [] }],
        [{ r: 'ひと', okuri: [], words: [word('人', 'ひと', 'person', [0, 2])] }]),
      休: kanji('N5', 2, ['rest', 'day off'], [{ c: '亻', m: 'person', base: '人' }, { c: '木', m: 'tree' }],
        [{ r: 'きゅう', words: [word('休日', 'きゅうじつ', 'holiday', [0, 3])] }],
        [{ r: 'やす', okuri: ['む', 'まる'], words: [word('休む', 'やすむ', 'to rest', [0, 2])] }],
        { story: 'A **person** rests by a tree.' }),
      本: kanji('N5', 2, ['book', 'origin'], [{ c: '木', m: 'tree' }, { c: '一', m: 'one' }],
        [{ r: 'ほん', words: [word('日本', 'にほん', 'Japan')] }],
        [{ r: 'もと', okuri: [], words: [] }]),
      林: kanji('N5', 2, ['grove'], [{ c: '木', m: 'tree' }],
        [{ r: 'りん', words: [] }],
        [{ r: 'はやし', okuri: [], words: [word('林', 'はやし', 'grove', [0, 3])] }]),
      森: kanji('N4', 1, ['forest'], [{ c: '木', m: 'tree' }, { c: '林', m: 'grove', sound: true, sr: 'りん' }],
        [{ r: 'しん', words: [word('森林', 'しんりん', 'forest', [0, 2])] }],
        [{ r: 'もり', okuri: [], words: [word('森', 'もり', 'forest', [0, 2])] }]),
    },
    components: {
      亻: { m: 'person', parts: [] },
      一: { m: 'one', parts: [] },
    },
    credits: [],
  };
}

export function fixtureData() {
  return indexData(fixtureRaw());
}

export function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}
