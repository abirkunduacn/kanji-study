import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { ACTIVE_USER_KEY, STORAGE_KEY } from '../../js/config.js';
import { createAccount, friendlyAuthError } from '../../js/account.js';
import { startCard } from '../../js/srs.js';
import { createStore, emptyState, mergeStates, normalizeState, userKey } from '../../js/store.js';
import { createSync, isOfflineError } from '../../js/sync.js';
import { memoryStorage } from './fixture.mjs';

const NOW = new Date(2026, 10, 24, 9, 0, 0).getTime();

function state(overrides) {
  return normalizeState({ ...emptyState(), ...overrides });
}

function fakeRemote(initial = {}) {
  const docs = new Map(Object.entries(initial));
  return {
    docs,
    saves: 0,
    failNext: null,
    async load(uid) {
      if (this.failNext) { const error = this.failNext; this.failNext = null; throw error; }
      return docs.get(uid) ?? null;
    },
    async save(uid, json) {
      this.saves += 1;
      docs.set(uid, json);
    },
  };
}

const manualTimers = () => {
  const pending = [];
  return { setTimeout: (fn) => { pending.push(fn); return pending.length; }, clearTimeout: () => { pending.length = 0; }, run: () => pending.splice(0).forEach((fn) => fn()), pending };
};

describe('Merging progress from two devices', () => {
  test('MRG001 each kanji keeps the copy that was reviewed more', () => {
    const phone = state({ cards: { 日: { ...startCard(NOW, 3), reviews: 5 }, 木: startCard(NOW) }, updated: NOW });
    const laptop = state({ cards: { 日: { ...startCard(NOW, 2), reviews: 2 }, 人: startCard(NOW) }, updated: NOW - 10 });
    const merged = mergeStates(phone, laptop);
    assert.deepEqual(Object.keys(merged.cards).sort(), ['人', '日', '木']);
    assert.equal(merged.cards.日.stage, 3);
  });

  test('MRG002 day counters and quiz tallies keep the higher number instead of adding up', () => {
    const a = state({ days: { '2026-11-24': { reviews: 5, correct: 4, learned: 0 } }, answers: { 日: { right: 3, wrong: 1 } } });
    const b = state({ days: { '2026-11-24': { reviews: 2, correct: 2, learned: 10 } }, answers: { 日: { right: 1, wrong: 2 } } });
    const merged = mergeStates(a, b);
    assert.deepEqual(merged.days['2026-11-24'], { reviews: 5, correct: 4, learned: 10 });
    assert.deepEqual(merged.answers.日, { right: 3, wrong: 2 });
  });

  test('MRG003 a reset on one device wins over older progress from the other', () => {
    const resetPhone = state({ resetAt: NOW, updated: NOW });
    const oldLaptop = state({ cards: { 日: startCard(NOW - 1000) }, updated: NOW - 1000 });
    assert.deepEqual(mergeStates(oldLaptop, resetPhone).cards, {});
    assert.deepEqual(mergeStates(resetPhone, oldLaptop).cards, {});
  });

  test('MRG004 a kanji removed from reviews stays removed after merging', () => {
    const card = startCard(NOW - 5000);
    const a = state({ cards: {}, removed: { 日: NOW }, updated: NOW });
    const b = state({ cards: { 日: card }, updated: NOW - 5000 });
    assert.equal(mergeStates(a, b).cards.日, undefined);
  });

  test('MRG005 notes and settings from the newer side win', () => {
    const newer = state({ notes: { 日: 'sun window' }, settings: { theme: 'dark' }, updated: NOW });
    const older = state({ notes: { 日: 'old', 木: 'tree' }, settings: { theme: 'light', reviewMode: 'cards' }, updated: NOW - 1 });
    const merged = mergeStates(older, newer);
    assert.deepEqual(merged.notes, { 日: 'sun window', 木: 'tree' });
    assert.deepEqual(merged.settings, { theme: 'dark', reviewMode: 'cards' });
  });
});

describe('Cloud sync', () => {
  let storage;
  let store;
  let remote;
  let timers;
  let statuses;
  beforeEach(() => {
    storage = memoryStorage();
    store = createStore(storage);
    remote = fakeRemote();
    timers = manualTimers();
    statuses = [];
  });
  const makeSync = (confirmAdopt = async () => false) => createSync({ store, remote, storage, timers, confirmAdopt, onStatus: (s) => statuses.push(s) });

  test('SYN001 signing in switches to that person’s progress and remembers who is signed in', async () => {
    remote.docs.set('u1', JSON.stringify(state({ cards: { 木: startCard(NOW) }, updated: NOW })));
    const sync = makeSync();
    await sync.start({ uid: 'u1' });
    assert.equal(store.storageKey, userKey('u1'));
    assert.ok(store.card('木'));
    assert.equal(storage.getItem(ACTIVE_USER_KEY), 'u1');
    assert.equal(statuses.at(-1), 'synced');
  });

  test('SYN002 changes are pushed after a short pause, merged with what the cloud already has', async () => {
    const sync = makeSync();
    await sync.start({ uid: 'u1' });
    remote.docs.set('u1', JSON.stringify(state({ cards: { 人: startCard(NOW) }, updated: NOW })));
    store.setCard('日', startCard(NOW));
    assert.equal(timers.pending.length, 1);
    timers.run();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = JSON.parse(remote.docs.get('u1'));
    assert.deepEqual(Object.keys(saved.cards).sort(), ['人', '日']);
    assert.ok(store.card('人'), 'the other device’s kanji arrives here too');
  });

  test('SYN003 a new account can take over progress made before signing in, if the person agrees', async () => {
    store.setCard('日', startCard(NOW));
    let asked = 0;
    const sync = makeSync(async () => { asked += 1; return true; });
    await sync.start({ uid: 'new' });
    assert.equal(asked, 1);
    assert.ok(store.card('日'));
    assert.equal(storage.getItem(STORAGE_KEY), null, 'the guest copy is moved, not duplicated');
    assert.ok(JSON.parse(remote.docs.get('new')).cards.日);
  });

  test('SYN004 an existing account is never mixed with someone else’s guest progress', async () => {
    store.setCard('日', startCard(NOW));
    remote.docs.set('u2', JSON.stringify(state({ cards: { 木: startCard(NOW) }, updated: NOW })));
    let asked = 0;
    const sync = makeSync(async () => { asked += 1; return true; });
    await sync.start({ uid: 'u2' });
    assert.equal(asked, 0);
    assert.equal(store.card('日'), undefined);
  });

  test('SYN005 signing out clears that person’s copy from the device and returns to guest progress', async () => {
    const sync = makeSync();
    await sync.start({ uid: 'u1' });
    store.setCard('日', startCard(NOW));
    sync.stop({ clearLocal: true });
    assert.equal(store.storageKey, STORAGE_KEY);
    assert.equal(storage.getItem(userKey('u1')), null);
    assert.equal(storage.getItem(ACTIVE_USER_KEY), null);
    assert.equal(sync.active, false);
  });

  test('SYN006 a network failure reports offline and keeps local progress', async () => {
    const sync = makeSync();
    await sync.start({ uid: 'u1' });
    store.setCard('日', startCard(NOW));
    remote.failNext = Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' });
    await sync.pushNow();
    assert.equal(statuses.at(-1), 'offline');
    assert.ok(store.card('日'));
    assert.ok(isOfflineError(new Error('Failed to fetch')));
    assert.ok(!isOfflineError(new Error('Missing or insufficient permissions.')));
  });
});

describe('Account', () => {
  function fakeFirebase() {
    const remote = fakeRemote();
    let listener = null;
    return {
      remote,
      emit: (user) => listener(user),
      onUser: (callback) => { listener = callback; },
      signIn: async () => {},
      signUp: async () => {},
      signInWithGoogle: async () => {},
      resetPassword: async () => {},
      signedOut: 0,
      async signOut() { this.signedOut += 1; },
    };
  }

  test('ACC001 without Firebase settings the account stays in local mode', async () => {
    const account = createAccount({ store: createStore(memoryStorage()), storage: memoryStorage(), configured: false });
    await account.init();
    assert.equal(account.state.status, 'local');
    assert.equal(account.state.ready, true);
  });

  test('ACC002 signing in and out through Firebase switches progress and re-renders', async () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    const firebase = fakeFirebase();
    let switches = 0;
    const account = createAccount({ store, storage, configured: true, connect: async () => firebase, onSwitch: () => { switches += 1; } });
    await account.init();
    await firebase.emit({ uid: 'u1', email: 'a@example.com', name: 'Aki' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(account.state.user.name, 'Aki');
    assert.equal(store.storageKey, userKey('u1'));
    assert.equal(account.state.status, 'synced');
    await account.signOut();
    assert.equal(store.storageKey, STORAGE_KEY);
    assert.equal(firebase.signedOut, 1);
    assert.ok(switches >= 2);
  });

  test('ACC003 sign-out is refused while the latest progress is unsaved, unless forced', async () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    const firebase = fakeFirebase();
    const account = createAccount({ store, storage, configured: true, connect: async () => firebase });
    await account.init();
    await firebase.emit({ uid: 'u1', email: 'a@example.com', name: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
    firebase.remote.failNext = new Error('network down');
    await assert.rejects(account.signOut(), (error) => error.code === 'unsynced');
    assert.equal(store.storageKey, userKey('u1'));
    firebase.remote.failNext = new Error('network down');
    await account.signOut({ force: true });
    assert.equal(store.storageKey, STORAGE_KEY);
  });

  test('ACC004 a failure to reach Firebase leaves the site usable', async () => {
    const account = createAccount({ store: createStore(memoryStorage()), storage: memoryStorage(), configured: true, connect: async () => { throw new Error('blocked'); } });
    await account.init();
    assert.equal(account.state.status, 'unavailable');
    assert.equal(account.state.ready, true);
  });

  test('ACC005 Firebase error codes become plain-language messages', () => {
    assert.equal(friendlyAuthError({ code: 'auth/invalid-credential' }), 'The email or password is wrong.');
    assert.equal(friendlyAuthError({ code: 'auth/unknown', message: 'Raw' }), 'Raw');
  });
});
