# Kanji Study — project notes

Static JLPT N5–N2 kanji site for GitHub Pages (repo `kanji-study`). Plain HTML/CSS/ES modules, no npm packages. The owner uses it mainly on a phone: check every UI change at 375 px wide.

## Commands (Windows, run from the repo root)

- Python tests: `.venv\Scripts\python.exe tests\test_build_data.py` (saves a log to tests/logs; never use `unittest discover`)
- JS tests: `node tests\js\run.mjs` (saves a log to tests/logs)
- Rebuild data: `.venv\Scripts\python.exe -I scripts\build_data.py` (needs `scripts\fetch_data.py` once to fill `.cache/`)
- Local preview: `.venv\Scripts\python.exe -I scripts\serve.py` (127.0.0.1:8000, caching off)
- Curation shortlists: `build_data.py --export-curation` writes `Temp/curation-input/`; validate with `scripts\check_curation.py <input> <curated part>`

## Where things live

- Build constants: `scripts/build_config.py`. App constants: `js/config.js`. Firebase project values: `js/firebase-config.js`.
- Memory stories and chosen common words: `curated/part-*.json` (source of truth, merged into `data/kanji.json` by the build).
- Progress is stored in localStorage under `kanjiStudy.v1` (guest) or `kanjiStudy.v1:<uid>` (signed in); cloud copy in Firestore `users/<uid>.progress`.

## When changing things

- Adding a JS file: also add it to `SHELL` in `sw.js`.
- Deploying: raise `APP_VERSION` in `js/config.js` so phones pick up the new service worker.
- Firebase SDK version is pinned in `js/config.js` (`FIREBASE_SDK_URL`).
