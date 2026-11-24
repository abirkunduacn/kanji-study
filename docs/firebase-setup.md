# Turn on sign-in with Firebase

Kanji Study works without accounts: progress is saved in each browser. Follow these steps once to let
people sign in, keep their own progress, and sync it between phone and computer. It takes about
10 minutes and uses Firebase's free Spark plan. No credit card is needed.

## 1. Create a Firebase project

1. Open <https://console.firebase.google.com> and sign in with your Google account.
2. Choose **Create a project**, name it (for example `kanji-study`), and continue.
3. Google Analytics is not needed. Turn it off, then choose **Create project**.

## 2. Turn on the sign-in methods

1. In the left menu, open **Build → Authentication** and choose **Get started**.
2. On the **Sign-in method** tab, choose **Email/Password**, switch on the first toggle and **Save**.
3. Choose **Add new provider → Google**, switch it on, pick your support email and **Save**.

## 3. Allow your site's address

1. Still in Authentication, open the **Settings** tab, then **Authorized domains**.
2. Choose **Add domain** and enter `abirkunduacn.github.io`.
   (`localhost` is already listed, which covers local testing.)

## 4. Create the database

1. Open **Build → Firestore Database** and choose **Create database**.
2. Pick a location close to you, for example `asia-northeast1 (Tokyo)`. It cannot be changed later.
3. Choose **Start in production mode** and **Create**.
4. Open the **Rules** tab, replace everything with the contents of [`firestore.rules`](../firestore.rules)
   from this repository, and choose **Publish**. These rules let each person read and write only their own progress.

## 5. Connect the site

1. Open **Project settings** (the gear icon next to *Project Overview*) → **General**.
2. Under **Your apps**, choose the web icon `</>`, enter a nickname such as `kanji-study`,
   leave *Firebase Hosting* unticked, and choose **Register app**.
3. Firebase shows a `firebaseConfig` block. Copy four of its values into
   [`js/firebase-config.js`](../js/firebase-config.js):

   ```js
   export const firebaseConfig = {
     apiKey: 'AIza…',
     authDomain: 'your-project.firebaseapp.com',
     projectId: 'your-project',
     appId: '1:1234567890:web:abc123',
   };
   ```

   These values are meant to be public. Each person's data is protected by the rules from step 4, not by hiding this file.
4. Commit and push the change. GitHub Pages updates the site within a minute or two.

## 6. Try it

1. Open the site and tap the **人** icon at the top (or **Sign in** on a computer).
2. Choose **Create account**. If the device already has progress, the site offers to move it into the new account.
3. Sign in on another device with the same account: your progress appears there too.

## Good to know

- **Free limits:** the Spark plan allows 50,000 database reads and 20,000 writes a day. One person studying
  uses a few dozen.
- **Offline:** progress is always saved on the device first and syncs when the connection returns.
- **Two devices at once:** each sync merges both sides. For each kanji, the copy reviewed more often wins.
- **Signing out** removes that person's progress from the device; it stays in their account.
- **iPhone home-screen app:** if Google sign-in does not open from the home-screen icon, sign in with email,
  or sign in once in Safari first.
- **Removing someone's data:** Firebase console → Authentication → Users (delete the account), and
  Firestore Database → `users` → their user id (delete the document).
