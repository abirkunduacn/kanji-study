import { ACTIVE_USER_KEY, APP_NAME, APP_VERSION, SERVICE_WORKER_URL, STORAGE_KEY } from './config.js';
import { createAccount } from './account.js';
import { loadData } from './data.js';
import { createScrollMemory } from './scroll-memory.js';
import { dueChars } from './srs.js';
import { createStore, defaultStorage, userKey } from './store.js';
import { esc, log, parseHash } from './util.js';
import * as accountView from './views/account.js';
import * as family from './views/family.js';
import * as home from './views/home.js';
import * as kanji from './views/kanji.js';
import * as learn from './views/learn.js';
import * as level from './views/level.js';
import * as quick from './views/quick.js';
import * as quiz from './views/quiz.js';
import * as review from './views/review.js';
import * as search from './views/search.js';
import * as settings from './views/settings.js';
import * as stats from './views/stats.js';

const ROUTES = [
  { pattern: /^\/$/, view: home, nav: 'home' },
  { pattern: /^\/level\/(N[2-5])$/, view: level, nav: 'home' },
  { pattern: /^\/kanji\/(.+)$/, view: kanji, nav: null },
  { pattern: /^\/quick(?:\/(N[2-5]))?$/, view: quick, nav: 'quick' },
  { pattern: /^\/learn\/(N[2-5])\/(\d+)$/, view: learn, nav: 'home' },
  { pattern: /^\/review$/, view: review, nav: 'review' },
  { pattern: /^\/quiz$/, view: quiz, nav: 'quiz' },
  { pattern: /^\/family(?:\/(.+))?$/, view: family, nav: 'family' },
  { pattern: /^\/stats$/, view: stats, nav: 'stats' },
  { pattern: /^\/search$/, view: search, nav: null },
  { pattern: /^\/settings$/, view: settings, nav: 'settings' },
  { pattern: /^\/account$/, view: accountView, nav: 'account' },
];

function setActiveNav(nav) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
  navigator.serviceWorker.register(`${SERVICE_WORKER_URL}?v=${encodeURIComponent(APP_VERSION)}`)
    .then(() => log('offline.ready', APP_VERSION))
    .catch((error) => log('offline.failed', error.message));
}

function updateAccountButton(account) {
  const { user } = account.state;
  document.querySelectorAll('[data-account]').forEach((link) => {
    link.querySelector('.avatar').textContent = user ? (user.name || user.email || '?').slice(0, 1).toUpperCase() : '人';
    link.querySelector('.account-text').textContent = user ? (user.name || 'Account') : 'Sign in';
    link.classList.toggle('is-signed-in', Boolean(user));
    link.setAttribute('aria-label', user ? `Account: ${user.name || user.email}` : 'Sign in');
  });
}

async function boot() {
  const storage = defaultStorage();
  const activeUid = storage?.getItem(ACTIVE_USER_KEY);
  const store = createStore(storage, activeUid ? userKey(activeUid) : STORAGE_KEY);
  settings.applyTheme(store.setting('theme', 'auto'));
  const root = document.getElementById('main');

  let data;
  try {
    data = await loadData();
  } catch (error) {
    log('data.failed', error.message);
    root.innerHTML = `<div class="empty"><p class="empty-title">The kanji list did not load.</p><p>${esc(error.message)} Check your connection and reload the page.</p></div>`;
    return;
  }

  function refreshBadge() {
    const count = dueChars(store.state.cards, Date.now()).length;
    document.querySelectorAll('[data-due-count]').forEach((badge) => {
      badge.textContent = count;
      badge.hidden = count === 0;
    });
  }

  const account = createAccount({
    store,
    storage,
    confirmAdopt: (guest) => window.confirm(`This device has progress from before you signed in (${Object.keys(guest.cards).length} kanji). Add it to your account?`),
    onSwitch: () => {
      settings.applyTheme(store.setting('theme', 'auto'));
      route();
    },
  });
  const ctx = { data, store, account, root, now: () => Date.now(), refreshBadge };
  let cleanup = null;
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  const scrollMemory = createScrollMemory({ history: window.history, getScroll: () => window.scrollY });

  function route() {
    const returnTo = scrollMemory.enter();
    cleanup?.();
    cleanup = null;
    const { path, query, anchor } = parseHash(window.location.hash);
    const match = ROUTES.map((r) => ({ route: r, found: path.match(r.pattern) })).find((m) => m.found);
    window.scrollTo(0, 0);
    root.focus({ preventScroll: true });
    if (!match) {
      root.innerHTML = '<div class="empty"><p class="empty-title">This page does not exist.</p><p><a href="#/">Go to the home page</a></p></div>';
      setActiveNav(null);
    } else {
      try {
        cleanup = match.route.view.render(ctx, match.found.slice(1), query, anchor) || null;
      } catch (error) {
        log('route.failed', { path, error: error.message });
        root.innerHTML = `<div class="empty"><p class="empty-title">This page hit an error.</p><p>${esc(error.message)}</p><p><a href="#/">Go to the home page</a></p></div>`;
      }
      setActiveNav(match.route.nav);
    }
    const heading = root.querySelector('h1')?.textContent.trim();
    document.title = heading && match?.route.view !== home ? `${heading} – ${APP_NAME}` : `${APP_NAME} – JLPT N5 to N2 kanji`;
    refreshBadge();
    log('route', path);
    if (returnTo !== null) {
      window.scrollTo(0, returnTo);
      log('route.scroll', returnTo);
    }
  }

  document.querySelector('[data-search]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = new FormData(event.target).get('q').trim();
    if (q) window.location.hash = `#/search?q=${encodeURIComponent(q)}`;
  });
  window.addEventListener('hashchange', route);
  const syncIfSignedIn = () => {
    if (account.state.user && navigator.onLine !== false) account.syncNow();
  };
  window.addEventListener('online', syncIfSignedIn);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncIfSignedIn();
  });
  account.subscribe(() => updateAccountButton(account));
  setInterval(refreshBadge, 60 * 1000);
  route();
  updateAccountButton(account);
  registerServiceWorker();
  account.init();
}

boot();
