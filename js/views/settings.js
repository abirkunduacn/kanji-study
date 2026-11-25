import { APP_VERSION, BACKUP_FILE_PREFIX, THEMES } from '../config.js';
import { dayKey, esc, log } from '../util.js';

export function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function render(ctx) {
  const { data, store, root } = ctx;
  const theme = store.setting('theme', 'auto');
  const cardCount = Object.keys(store.state.cards).length;
  const lastExport = store.setting('lastExport', null);
  const rescue = store.rescue();

  root.innerHTML = `<div class="settings">
    <header class="page-head"><h1>Settings and backup</h1></header>

    ${rescue ? `<section class="panel panel--rescue">
      <h2>Progress kept from an update</h2>
      <p>Some progress saved on this device could not be read after an update, so an untouched copy was kept. Download it, then use “Restore from file” once the site has been fixed.</p>
      <div class="actions">
        <button class="button button--primary" data-action="rescue-download">Download the kept copy</button>
        <button class="button button--quiet" data-action="rescue-delete">Delete the kept copy</button>
      </div>
    </section>` : ''}

    <section class="panel">
      <h2>Back up your progress</h2>
      ${ctx.account?.state.user
        ? `<p>You are signed in as ${esc(ctx.account.state.user.name || ctx.account.state.user.email)}, so your progress is saved to your account and syncs between devices. A progress file is an extra copy.</p>`
        : `<p>Your progress is saved in this browser only. <a href="#/account">Sign in</a> to sync it between devices, or download a progress file to keep a copy.</p>`}
      <p class="hint">${cardCount} kanji in your reviews. ${lastExport ? `Last backup: ${esc(new Date(lastExport).toLocaleString())}.` : 'No backup yet.'}</p>
      <div class="actions">
        <button class="button button--primary" data-action="export">Download progress file</button>
        <label class="button file-button">Restore from file<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
      <p class="import-result" aria-live="polite"></p>
    </section>

    <section class="panel">
      <h2>Appearance</h2>
      <fieldset class="segmented"><legend class="sr-only">Theme</legend>
        ${THEMES.map((t) => `<label><input type="radio" name="theme" value="${t.id}" ${t.id === theme ? 'checked' : ''}><span>${esc(t.label)}</span></label>`).join('')}
      </fieldset>
    </section>

    <section class="panel">
      <h2>Use it offline</h2>
      <p>After the first visit, the site works without a connection. On a phone, choose “Add to Home screen” in the browser menu to open it like an app.</p>
    </section>

    <section class="panel">
      <h2>Start over</h2>
      <p>Clear every review, note and quiz result on this device. Download a progress file first if you might want them back.</p>
      <button class="button button--danger" data-action="reset">Clear all progress</button>
    </section>

    <section class="panel credits">
      <h2>About the data</h2>
      <p>JLPT levels follow the widely used unofficial lists; the official JLPT has not published kanji lists since 2010. Memory stories are memory aids written for this site, not etymology.</p>
      <ul>${data.credits.map((c) => `<li><a href="${esc(c.home)}" rel="noopener">${esc(c.credit)}</a>, ${esc(c.license)}</li>`).join('')}</ul>
      <p class="hint">Content derived from these sources is shared under CC BY-SA 4.0. Data built ${esc(data.built)}, app version ${esc(APP_VERSION)}.</p>
    </section></div>`;

  const result = root.querySelector('.import-result');
  root.querySelector('.settings').addEventListener('change', async (event) => {
    if (event.target.name === 'theme') {
      store.setSetting('theme', event.target.value);
      applyTheme(event.target.value);
    }
    if (event.target.dataset.action === 'import') {
      const file = event.target.files[0];
      if (!file) return;
      if (!window.confirm('Restoring replaces all progress on this device with the progress in the file. Continue?')) {
        event.target.value = '';
        return;
      }
      try {
        const count = store.importText(await file.text());
        result.textContent = `Restored ${count} kanji from ${file.name}.`;
        applyTheme(store.setting('theme', 'auto'));
        ctx.refreshBadge();
      } catch (error) {
        log('backup.import-failed', error.message);
        result.textContent = `Could not restore: ${error.message}`;
      }
      event.target.value = '';
    }
  });

  root.querySelector('[data-action="export"]').addEventListener('click', () => {
    const now = ctx.now();
    store.setSetting('lastExport', now);
    downloadText(store.exportText(), `${BACKUP_FILE_PREFIX}-${dayKey(now)}.json`);
    render(ctx);
  });

  root.querySelector('[data-action="rescue-download"]')?.addEventListener('click', () => {
    downloadText(rescue, `${BACKUP_FILE_PREFIX}-kept-${dayKey(ctx.now())}.json`);
    log('store.rescue-download', { length: rescue.length });
  });

  root.querySelector('[data-action="rescue-delete"]')?.addEventListener('click', () => {
    if (!window.confirm('Delete the kept copy? Download it first if you might want that progress back.')) return;
    store.clearRescue();
    render(ctx);
  });

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    if (!window.confirm('Clear all progress on this device? This cannot be undone.')) return;
    store.reset();
    ctx.refreshBadge();
    render(ctx);
  });
}
