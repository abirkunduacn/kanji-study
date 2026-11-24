import { ACTIVE_USER_KEY, FIREBASE_SDK_URL, STORAGE_KEY, USERS_COLLECTION } from './config.js';
import { firebaseConfig } from './firebase-config.js';
import { createSync } from './sync.js';
import { log } from './util.js';

const AUTH_MESSAGES = {
  'auth/invalid-credential': 'The email or password is wrong.',
  'auth/wrong-password': 'The email or password is wrong.',
  'auth/user-not-found': 'The email or password is wrong.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/popup-closed-by-user': 'The Google window was closed before sign-in finished.',
  'auth/cancelled-popup-request': 'The Google window was closed before sign-in finished.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site, or sign in with email.',
  'auth/network-request-failed': 'No connection. Try again when you are online.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/unauthorized-domain': 'This site’s address is not on the Firebase list of authorized domains yet.',
  'auth/operation-not-allowed': 'This sign-in method is turned off in the Firebase console.',
};

export function friendlyAuthError(error) {
  return AUTH_MESSAGES[error?.code] || error?.message || 'Something went wrong. Try again.';
}

export function cloudConfigured(config = firebaseConfig) {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}

const loadSdk = (name) => import(`${FIREBASE_SDK_URL}/${name}.js`);

// Wrap the Firebase SDK in the few calls the app needs.
export async function connectFirebase(config = firebaseConfig, load = loadSdk) {
  const [appSdk, authSdk, dbSdk] = await Promise.all([load('firebase-app'), load('firebase-auth'), load('firebase-firestore')]);
  const app = appSdk.initializeApp(config);
  const auth = authSdk.getAuth(app);
  const db = dbSdk.getFirestore(app);
  const userDoc = (uid) => dbSdk.doc(db, USERS_COLLECTION, uid);
  log('account.firebase-ready', config.projectId);
  return {
    onUser: (callback) => authSdk.onAuthStateChanged(auth, (user) => callback(user ? { uid: user.uid, email: user.email, name: user.displayName } : null)),
    signIn: (email, password) => authSdk.signInWithEmailAndPassword(auth, email, password),
    async signUp(email, password, name) {
      const credential = await authSdk.createUserWithEmailAndPassword(auth, email, password);
      if (name) await authSdk.updateProfile(credential.user, { displayName: name });
      return credential;
    },
    signInWithGoogle: () => authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider()),
    resetPassword: (email) => authSdk.sendPasswordResetEmail(auth, email),
    signOut: () => authSdk.signOut(auth),
    remote: {
      async load(uid) {
        const snapshot = await dbSdk.getDoc(userDoc(uid));
        return snapshot.exists() ? snapshot.data().progress ?? null : null;
      },
      save: (uid, json) => dbSdk.setDoc(userDoc(uid), { progress: json, updatedAt: dbSdk.serverTimestamp() }),
    },
  };
}

/**
 * Sign-in state for the whole app. Status is one of:
 * local (no cloud set up), connecting, unavailable, signed-out, syncing, synced, offline, error.
 */
export function createAccount({ store, storage, connect = connectFirebase, configured = cloudConfigured(), confirmAdopt, onSwitch = () => {} }) {
  const listeners = new Set();
  const state = { configured, ready: !configured, user: null, status: configured ? 'connecting' : 'local', message: '', lastSynced: null };
  let firebase = null;
  let sync = null;

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  function setStatus(status, message = '') {
    state.status = status;
    state.message = message;
    if (status === 'synced') state.lastSynced = Date.now();
    emit();
  }

  async function handleUser(user) {
    state.ready = true;
    state.user = user;
    if (user) {
      await sync.start(user);
      onSwitch();
    } else {
      if (sync.active) sync.stop({ clearLocal: false });
      if (store.storageKey !== STORAGE_KEY) {
        storage?.removeItem(ACTIVE_USER_KEY);
        store.use(STORAGE_KEY);
      }
      onSwitch();
      setStatus('signed-out');
    }
    emit();
  }

  async function init() {
    if (!configured) return;
    try {
      firebase = await connect();
    } catch (error) {
      log('account.connect-failed', error.message);
      state.ready = true;
      setStatus('unavailable', 'Could not reach the sign-in service. Your progress is still saved on this device.');
      return;
    }
    sync = createSync({ store, remote: firebase.remote, storage, onStatus: setStatus, confirmAdopt });
    firebase.onUser((user) => {
      handleUser(user).catch((error) => setStatus('error', error.message));
    });
  }

  function requireFirebase() {
    if (!firebase) throw new Error('Sign-in is not available right now.');
    return firebase;
  }

  return {
    state,
    init,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: (email, password) => requireFirebase().signIn(email, password),
    signUp: (email, password, name) => requireFirebase().signUp(email, password, name),
    signInWithGoogle: () => requireFirebase().signInWithGoogle(),
    resetPassword: (email) => requireFirebase().resetPassword(email),
    syncNow: () => sync?.pushNow(),
    // Refuses (code "unsynced") when the latest progress could not be saved, unless forced.
    async signOut({ force = false } = {}) {
      const fb = requireFirebase();
      await sync.pushNow();
      if (state.status !== 'synced' && !force) {
        const error = new Error('Your latest progress is not saved to your account yet.');
        error.code = 'unsynced';
        throw error;
      }
      sync.stop({ clearLocal: true });
      onSwitch();
      await fb.signOut();
      log('account.signed-out');
    },
  };
}
