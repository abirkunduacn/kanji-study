import { ACTIVE_USER_KEY, STORAGE_KEY, SYNC_DEBOUNCE_MS } from './config.js';
import { isEmptyState, mergeStates, normalizeState, userKey } from './store.js';
import { log } from './util.js';

const OFFLINE_HINTS = ['offline', 'network', 'unavailable', 'failed to fetch'];

export function isOfflineError(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return OFFLINE_HINTS.some((hint) => text.includes(hint));
}

/**
 * Keeps one signed-in person's progress in step with the cloud.
 * `remote` has load(uid) -> JSON string or null, and save(uid, json).
 * Every sync pulls first and merges, so studying on two devices never overwrites either one.
 */
export function createSync({ store, remote, storage, onStatus = () => {}, confirmAdopt = async () => false, debounceMs = SYNC_DEBOUNCE_MS, timers = globalThis }) {
  let uid = null;
  let unsubscribe = null;
  let timer = null;

  async function pull(forUid) {
    const json = await remote.load(forUid);
    return json ? normalizeState(JSON.parse(json)) : null;
  }

  async function pushNow() {
    if (!uid) return;
    timers.clearTimeout(timer);
    timer = null;
    const current = uid;
    onStatus('syncing');
    try {
      const remoteState = await pull(current);
      if (current !== uid) return;
      const local = store.snapshot();
      const merged = remoteState ? mergeStates(local, remoteState) : local;
      if (JSON.stringify(merged) !== JSON.stringify(local)) store.replace(merged, 'sync.merge');
      await remote.save(current, JSON.stringify(merged));
      log('sync.pushed', { cards: Object.keys(merged.cards).length });
      onStatus('synced');
    } catch (error) {
      log('sync.failed', error.message);
      onStatus(isOfflineError(error) ? 'offline' : 'error', error.message);
    }
  }

  function schedule(_state, action) {
    if (!uid || String(action).startsWith('sync.') || action === 'store.use') return;
    timers.clearTimeout(timer);
    timer = timers.setTimeout(pushNow, debounceMs);
  }

  async function start(user) {
    if (uid === user.uid) return pushNow();
    const guest = store.storageKey === STORAGE_KEY ? store.snapshot() : null;
    uid = user.uid;
    storage?.setItem(ACTIVE_USER_KEY, uid);
    if (store.storageKey !== userKey(uid)) store.use(userKey(uid));
    log('sync.start', { uid });
    if (guest && !isEmptyState(guest) && isEmptyState(store.snapshot())) {
      try {
        const remoteState = await pull(uid);
        if ((!remoteState || isEmptyState(remoteState)) && await confirmAdopt(guest)) {
          store.replace({ ...guest, updated: Date.now() }, 'sync.adopt-guest');
          storage?.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        log('sync.adopt-skipped', error.message);
      }
    }
    unsubscribe?.();
    unsubscribe = store.subscribe(schedule);
    return pushNow();
  }

  function stop({ clearLocal }) {
    if (!uid) return;
    timers.clearTimeout(timer);
    unsubscribe?.();
    unsubscribe = null;
    const key = userKey(uid);
    log('sync.stop', { uid, clearLocal });
    uid = null;
    storage?.removeItem(ACTIVE_USER_KEY);
    if (clearLocal) storage?.removeItem(key);
    store.use(STORAGE_KEY);
  }

  return {
    start,
    stop,
    pushNow,
    get active() {
      return uid !== null;
    },
  };
}
