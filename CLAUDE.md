# Kanji Study — project notes

Static JLPT N5–N2 kanji site for GitHub Pages (repo `kanji-study`). Plain HTML/CSS/ES modules, no npm packages. The owner uses it mainly on a phone: check every UI change at 375 px wide.

## Commands (Windows, run from the repo root)

- Python tests: `.venv\Scripts\python.exe tests\test_build_data.py` (saves a log to tests/logs; never use `unittest discover`)
- JS tests: `node tests\js\run.mjs` (saves a log to tests/logs)
- Rebuild data: `.venv\Scripts\python.exe -I scripts\build_data.py` (needs `scripts\fetch_data.py` once to fill `.cache/`)
- Local preview: `.venv\Scripts\python.exe -I scripts\serve.py` (127.0.0.1:8000, caching off; add a port such as `8010` when 8000 is busy, launch config `kanji-site-8010`)
- Curation shortlists: `build_data.py --export-curation` writes `Temp/curation-input/`; validate with `scripts\check_curation.py <input> <curated part>`

## Where things live

- Build constants: `scripts/build_config.py`. App constants: `js/config.js`. Firebase project values: `js/firebase-config.js`.
- Memory stories and chosen common words: `curated/part-*.json` (source of truth, merged into `data/kanji.json` by the build).
- Progress is stored in localStorage under `kanjiStudy.v1` (guest) or `kanjiStudy.v1:<uid>` (signed in); cloud copy in Firestore `users/<uid>.progress`.

## When changing things

- Adding a JS file: also add it to `SHELL` in `sw.js`.
- Deploying: raise `APP_VERSION` in `js/config.js` so phones pick up the new service worker.
- Queued fixes for the next version are listed in `docs/next-version.md`. Do them before the next deploy and remove each entry once it ships.
- Firebase SDK version is pinned in `js/config.js` (`FIREBASE_SDK_URL`).

## Updates must never reset users' progress

- Progress lives in each browser under this site's address and the keys `STORAGE_KEY`, `userKey()` and `ACTIVE_USER_KEY`. Never rename them, and never move the site to a new address (renaming the repo, adding a custom domain) without a way to carry progress over. Signed-in users would get theirs back from the cloud; guests would lose it.
- To change the saved format, keep reading the old one: convert it in `normalizeState` (`js/store.js`). `tests/js/progress.test.mjs` loads `tests/js/saved-progress-2026-11.json`, progress as saved on 2026-11-24. Never edit that file to make a test pass.
- If saved progress cannot be read, the store keeps the original untouched under `<key>.rescue`, and Settings offers it for download. Keep that path working.
- When a data rebuild drops a kanji, keep its card (it returns if the kanji comes back); views hide it with `data.isStudy`. Never delete cards because a kanji left the list.
- Before deploying, run both test suites; a failing PRG test blocks the deploy.
