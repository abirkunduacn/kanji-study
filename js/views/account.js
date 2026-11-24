import { MIN_PASSWORD_LENGTH } from '../config.js';
import { friendlyAuthError } from '../account.js';
import { esc, log } from '../util.js';

const STATUS_TEXT = {
  syncing: 'Saving to your account…',
  synced: 'All progress is saved to your account.',
  offline: 'You are offline. Progress is saved on this device and will sync when you reconnect.',
  error: 'The last sync failed.',
  connecting: 'Connecting…',
};

function notConfigured() {
  return `
    <div class="account-box">
      <h1>Account</h1>
      <p>Cloud sign-in is not set up for this site yet, so progress is saved in this browser only.</p>
      <p class="hint">Site owner: follow <code>docs/firebase-setup.md</code> to create a free Firebase project, then add its settings to <code>js/firebase-config.js</code>.</p>
      <p><a href="#/settings">Back up progress to a file instead</a></p>
    </div>`;
}

function signedOutForm(mode) {
  const creating = mode === 'create';
  return `
    <div class="account-box">
      <h1>${creating ? 'Create your account' : 'Sign in'}</h1>
      <p>Each person signs in with their own account, so everyone keeps their own progress. It syncs between your phone and computer.</p>
      <div class="segmented account-mode" role="tablist">
        <button type="button" role="tab" data-mode="signin" aria-selected="${!creating}">Sign in</button>
        <button type="button" role="tab" data-mode="create" aria-selected="${creating}">Create account</button>
      </div>
      <form class="account-form" novalidate>
        ${creating ? '<label>Name <span class="hint">(optional)</span><input name="name" autocomplete="name" maxlength="40"></label>' : ''}
        <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label>
        <label>Password<input name="password" type="password" autocomplete="${creating ? 'new-password' : 'current-password'}" minlength="${MIN_PASSWORD_LENGTH}" required>
          ${creating ? `<span class="hint">At least ${MIN_PASSWORD_LENGTH} characters.</span>` : ''}</label>
        <p class="form-error" role="alert"></p>
        <button class="button button--primary" type="submit">${creating ? 'Create account' : 'Sign in'}</button>
        ${creating ? '' : '<button class="button button--quiet" type="button" data-action="reset">Forgot password?</button>'}
      </form>
      <div class="or"><span>or</span></div>
      <button class="button google" type="button" data-action="google"><span class="google-g" aria-hidden="true">G</span>Continue with Google</button>
    </div>`;
}

function signedIn(account) {
  const { user, status, message, lastSynced } = account.state;
  const text = STATUS_TEXT[status] || '';
  return `
    <div class="account-box">
      <h1>Your account</h1>
      <p class="signed-in-as"><span class="avatar" aria-hidden="true">${esc((user.name || user.email || '?').slice(0, 1).toUpperCase())}</span>
        <span>Signed in as <strong>${esc(user.name || user.email)}</strong>${user.name ? `<br><span class="hint">${esc(user.email)}</span>` : ''}</span></p>
      <p class="sync-status sync-status--${esc(status)}" aria-live="polite">${esc(text)}${status === 'error' && message ? ` ${esc(message)}` : ''}${lastSynced && status !== 'syncing' ? ` <span class="hint">Last saved at ${esc(new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}.</span>` : ''}</p>
      <div class="actions">
        <button class="button" type="button" data-action="sync">Sync now</button>
        <button class="button button--quiet" type="button" data-action="signout">Sign out</button>
      </div>
      <p class="hint">Signing out removes your progress from this device. It stays in your account, ready for next time.</p>
    </div>`;
}

export function render(ctx) {
  const { account, root } = ctx;
  let mode = 'signin';

  function draw() {
    const { configured, ready, user } = account.state;
    if (!configured) root.innerHTML = notConfigured();
    else if (!ready) root.innerHTML = `<div class="account-box"><h1>Account</h1><p>${esc(account.state.status === 'unavailable' ? account.state.message : 'Connecting…')}</p></div>`;
    else if (!user) root.innerHTML = account.state.status === 'unavailable' ? `<div class="account-box"><h1>Account</h1><p>${esc(account.state.message)}</p></div>` : signedOutForm(mode);
    else root.innerHTML = signedIn(account);
  }

  function showError(text) {
    const target = root.querySelector('.form-error');
    if (target) target.textContent = text;
  }

  async function attempt(action, button) {
    if (button) button.disabled = true;
    showError('');
    try {
      await action();
    } catch (error) {
      log('account.error', error.code || error.message);
      showError(friendlyAuthError(error));
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }

  async function onSubmit(event) {
    if (!event.target.matches('.account-form')) return;
    event.preventDefault();
    const values = new FormData(event.target);
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    if (!email) { showError('Enter your email address.'); return; }
    if (password.length < MIN_PASSWORD_LENGTH) { showError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    const button = event.target.querySelector('[type="submit"]');
    await attempt(() => (mode === 'create'
      ? account.signUp(email, password, String(values.get('name') || '').trim())
      : account.signIn(email, password)), button);
  }

  async function onClick(event) {
    const modeButton = event.target.closest('[data-mode]');
    if (modeButton) { mode = modeButton.dataset.mode; draw(); return; }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'google') await attempt(() => account.signInWithGoogle(), button);
    if (action === 'reset') {
      const email = String(root.querySelector('input[name="email"]')?.value || '').trim();
      if (!email) { showError('Enter your email above, then choose "Forgot password?" again.'); return; }
      await attempt(async () => {
        await account.resetPassword(email);
        showError(`We sent a password reset link to ${email}.`);
      }, button);
    }
    if (action === 'sync') await attempt(() => account.syncNow(), button);
    if (action === 'signout') {
      try {
        await account.signOut();
      } catch (error) {
        if (error.code !== 'unsynced') throw error;
        if (window.confirm(`${error.message} If you sign out now, recent progress on this device will be lost. Sign out anyway?`)) await account.signOut({ force: true });
      }
    }
  }

  const unsubscribe = account.subscribe(() => {
    if (!root.querySelector('.account-form input:focus')) draw();
  });
  root.addEventListener('submit', onSubmit);
  root.addEventListener('click', onClick);
  draw();
  return () => {
    unsubscribe();
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('click', onClick);
  };
}
