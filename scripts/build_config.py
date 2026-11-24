from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / ".cache" / "downloads"
OUTPUT_FILE = ROOT / "data" / "kanji.json"
CURATED_DIR = ROOT / "curated"
CURATION_INPUT_DIR = ROOT / "Temp" / "curation-input"
CURATION_CHUNKS = 10
LOG_DIR = ROOT / "logs"

_JMDICT_RELEASE = "https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261116213322"

# Each source downloads into its own directory under CACHE_DIR.
SOURCES = {
    "kanji-data": {
        "url": "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/00fd7079c3890f430759536f91aa5e854ec0ca4f/kanji.json",
        "file": "kanji.json",
        "license": "MIT",
        "credit": "kanji-data by David Gouveia (JLPT levels from Jonathan Waller's lists)",
        "home": "https://github.com/davidluzgouveia/kanji-data",
    },
    "kanjivg": {
        "url": "https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714.xml.gz",
        "file": "kanjivg.xml.gz",
        "license": "CC BY-SA 3.0",
        "credit": "KanjiVG by Ulrich Apel and contributors",
        "home": "https://kanjivg.tagaini.net",
    },
    "jmdict": {
        "url": f"{_JMDICT_RELEASE}/jmdict-eng-common-3.6.2%2B20261116213322.json.zip",
        "file": "jmdict-eng-common.json.zip",
        "license": "CC BY-SA 4.0",
        "credit": "JMdict by the Electronic Dictionary Research and Development Group, via jmdict-simplified",
        "home": "https://www.edrdg.org/jmdict/j_jmdict.html",
    },
    "kanjidic2": {
        "url": f"{_JMDICT_RELEASE}/kanjidic2-en-3.6.2%2B20261116213322.json.zip",
        "file": "kanjidic2-en.json.zip",
        "license": "CC BY-SA 4.0",
        "credit": "KANJIDIC2 by the Electronic Dictionary Research and Development Group, via jmdict-simplified",
        "home": "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
    },
}

LEVELS = ["N5", "N4", "N3", "N2"]
LESSON_SIZE = 10
MAX_MEANINGS = 4
MAX_GLOSSES = 3
WORDS_PER_ON_READING = 3
WORDS_PER_KUN_READING = 2
MAX_WORD_LENGTH = 4
CANDIDATES_PER_READING = 15
CANDIDATE_GLOSS_LENGTH = 45
MAX_STORY_LENGTH = 220
MAX_SOUND_READINGS = 2

# Readings missing from KANJIDIC that common words need for alignment (日本 = に + ほん).
EXTRA_READINGS = {"日": ["に"]}

# JMdict misc tags that make a word a poor example for learners.
EXCLUDED_MISC_TAGS = {"arch", "obs", "obsc", "rare", "vulg", "derog", "sl", "X", "uk", "rk", "sK", "ik", "oK", "iK"}

DOWNLOAD_TIMEOUT_SECONDS = 120
