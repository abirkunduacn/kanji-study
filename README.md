# Kanji Study

A free website for learning and reviewing the 979 kanji of JLPT N5 to N2, built for phones first.

**Use it:** <https://abirkunduacn.github.io/kanji-study/>. On a phone, choose *Add to Home screen* to open it like an app. It also works offline.

## What it does

- **Quick review** of each level: the kanji large, its meaning, kun'yomi and on'yomi in hiragana, and the most common words for each reading, with the kanji's part of the reading highlighted. *Test myself* hides the answers until you tap.
- **Remember it:** every kanji shows its radical and the parts it is built from (亻 person + 木 tree = 休 rest), a short memory story, and a box for your own note.
- **Lessons** of 10 kanji, ordered so the parts come before the kanji that use them, each ending in a short quiz.
- **Spaced-repetition reviews** as multiple choice or flashcards. Kanji come back after 4 hours, 1 day, 3 days, 1 week, 2 weeks, 1 month, 2 months and 4 months; mistakes bring them back sooner.
- **Practice quiz** on any level: kanji to meaning, meaning to kanji, readings and word readings.
- **Family map:** pick a part such as 木 and see every kanji that grows from it.
- **Progress:** each level as a grid of squares that fill in as you learn, the reviews coming up this week, and the kanji you miss most.
- **Accounts (optional):** sign in with email or Google so each person keeps their own progress, synced between devices. See [docs/firebase-setup.md](docs/firebase-setup.md). Without it, progress is saved in the browser, with backup to a file.

## Data and credits

| Source | Used for | License |
|---|---|---|
| [kanji-data](https://github.com/davidluzgouveia/kanji-data) (JLPT levels from Jonathan Waller's lists) | JLPT level, readings, stroke count | MIT |
| [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project), EDRDG, via [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) | meanings, radicals | CC BY-SA 4.0 |
| [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html), EDRDG, via jmdict-simplified | example words | CC BY-SA 4.0 |
| [KanjiVG](https://kanjivg.tagaini.net) | parts of each kanji | CC BY-SA 3.0 |

The JLPT has not published official kanji lists since 2010; the levels follow the widely used unofficial lists. Memory stories and the choice of common words were written for this site. The stories are memory aids, not etymology.

## Development

No build tools or packages are needed: the site is plain HTML, CSS and JavaScript modules.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -I scripts\fetch_data.py      # download the source datasets into .cache/
.venv\Scripts\python.exe -I scripts\build_data.py      # write data/kanji.json
.venv\Scripts\python.exe -I scripts\serve.py           # preview at http://127.0.0.1:8000
.venv\Scripts\python.exe tests\test_build_data.py      # data pipeline tests
node tests\js\run.mjs                                  # app logic tests
```

- `scripts/` builds the data: readings are matched to each word (学校 = がっ + こう), common words are ranked, and parts come from KanjiVG.
- `curated/` holds the memory stories and hand-picked common words. Check a chunk with `scripts/check_curation.py`.
- `js/` is the app; `js/views/` has one file per page. Settings that rarely change are in `js/config.js`.
- `sw.js` makes the site work offline. When you deploy a change, raise `APP_VERSION` in `js/config.js`.

## License

The code is under the MIT License. `data/kanji.json` and `curated/` are under CC BY-SA 4.0, because they are derived from the sources above. See [LICENSE](LICENSE).
