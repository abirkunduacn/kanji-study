import argparse
import datetime
import gzip
import json
import logging
import math
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_config as cfg  # noqa: E402
from align import align, reading_options  # noqa: E402
from kana import is_kanji, kata_to_hira  # noqa: E402
from radicals import part_name, radical_by_number  # noqa: E402

log = logging.getLogger("build_data")

KVG = "{http://kanjivg.tagaini.net}"
LEVEL_RANK = {level: i for i, level in enumerate(cfg.LEVELS)}
UNKNOWN_FREQ = 3000
SPECIAL = ("special", "")
RADICAL_NOTE = re.compile(r"radical\s*\(no\.?\s*\d+\)", re.IGNORECASE)


def source_path(name):
    return cfg.CACHE_DIR / name / cfg.SOURCES[name]["file"]


def read_zipped_json(path):
    with zipfile.ZipFile(path) as archive:
        return json.loads(archive.read(archive.namelist()[0]))


# ---------- sources ----------

def select_study_kanji(kanji_data):
    level_by_number = {int(level[1]): level for level in cfg.LEVELS}
    return {char: level_by_number[entry["jlpt_new"]]
            for char, entry in kanji_data.items() if entry.get("jlpt_new") in level_by_number}


def clean_meanings(meanings):
    """Drop dictionary notes such as "one radical (no.1)" unless nothing else is left."""
    kept = [m for m in meanings if not RADICAL_NOTE.search(m)]
    return kept or meanings


def load_kanjidic(path):
    result = {}
    for entry in read_zipped_json(path)["characters"]:
        groups = (entry.get("readingMeaning") or {}).get("groups", [])
        meanings = clean_meanings([m["value"] for group in groups for m in group["meanings"] if m["lang"] == "en"])
        classical = next((r["value"] for r in entry["radicals"] if r["type"] == "classical"), None)
        result[entry["literal"]] = {"meanings": meanings, "radical": classical, "freq": entry["misc"].get("frequency")}
    log.info("loaded kanjidic2: %d characters", len(result))
    return result


def _part_list(group):
    """Direct named parts of a KanjiVG group, skipping unnamed wrapper groups."""
    parts, seen = [], set()
    for child in group.findall("g"):
        element = child.get(KVG + "element")
        found = _part_list(child) if not element else [{
            "c": element,
            "orig": child.get(KVG + "original"),
            "phon": (child.get(KVG + "phon") or "").rstrip("V") == element,
            "node": child,
        }]
        for part in found:
            if part["c"] not in seen:
                seen.add(part["c"])
                parts.append(part)
    return parts


def _public(part):
    orig = part["orig"] if part["orig"] and is_kanji(part["orig"]) else None
    return {"c": part["c"], "orig": orig, "phon": part["phon"]}


def _radical_form(group):
    for child in group.iter("g"):
        if child.get(KVG + "radical") in ("general", "tradit") and child.get(KVG + "element"):
            return child.get(KVG + "element"), child.get(KVG + "original")
    return None, None


def parse_kanjivg_tree(root, wanted):
    """Return ({kanji: parts}, {component: sub-parts}, {kanji: (radical form, original)})."""
    parts_by_kanji, sub_parts, radical_forms = {}, {}, {}

    def record_component(part):
        children = _part_list(part["node"])
        sub_parts.setdefault(part["c"], [_public(p) for p in children])
        for child in children:
            record_component(child)

    for kanji in root.iter("kanji"):
        kanji_id = kanji.get("id", "")
        top = kanji.find("g")
        if "-" in kanji_id or top is None:
            continue
        char = chr(int(kanji_id.split("_")[1], 16))
        if char not in wanted:
            continue
        parts = [p for p in _part_list(top) if p["c"] != char]
        parts_by_kanji[char] = [_public(p) for p in parts]
        radical_forms[char] = _radical_form(top)
        for part in parts:
            record_component(part)
    return parts_by_kanji, sub_parts, radical_forms


def load_kanjivg(path, wanted):
    with gzip.open(path, "rb") as handle:
        root = ET.parse(handle).getroot()
    result = parse_kanjivg_tree(root, wanted)
    log.info("parsed kanjivg: %d study kanji, %d components", len(result[0]), len(result[1]))
    return result


def _has_excluded(tags):
    return any(tag in cfg.EXCLUDED_MISC_TAGS for tag in tags)


def jmdict_candidates(words):
    """Yield (text, reading, gloss) for the preferred common spelling of each entry."""
    for entry in words:
        kanji_form = next((k for k in entry["kanji"] if k["common"] and not _has_excluded(k["tags"])), None)
        if not kanji_form or not entry["sense"]:
            continue
        text = kanji_form["text"]
        kana = next((k for k in entry["kana"] if not _has_excluded(k["tags"])
                     and ("*" in k["appliesToKanji"] or text in k["appliesToKanji"])), None)
        sense = entry["sense"][0]
        if not kana or _has_excluded(sense["misc"]):
            continue
        yield text, kana["text"], "; ".join(g["text"] for g in sense["gloss"][:cfg.MAX_GLOSSES])


def load_jmdict(path):
    words = list(jmdict_candidates(read_zipped_json(path)["words"]))
    log.info("loaded jmdict: %d usable common words", len(words))
    return words


# ---------- words per reading ----------

def build_reading_lookup(kanji_data, extra=None):
    extra = extra if extra is not None else cfg.EXTRA_READINGS
    return {char: reading_options(entry.get("readings_on"), entry.get("readings_kun"), extra.get(char, ()))
            for char, entry in kanji_data.items()}


def productivity(texts):
    """How many other words contain each multi-character word: a rough proxy for how basic it is."""
    texts = set(texts)
    counts = Counter()
    for text in texts:
        for size in range(2, len(text)):
            for start in range(len(text) - size + 1):
                piece = text[start:start + size]
                if piece in texts:
                    counts[piece] += 1
    return counts


def word_score(text, char, kind, study, freq, contained_in):
    kanji_chars = [c for c in text if is_kanji(c)]
    hardest = max(LEVEL_RANK[study[c]] for c in kanji_chars)
    own = LEVEL_RANK[study[char]]
    avg_freq = sum(freq.get(c) or UNKNOWN_FREQ for c in kanji_chars) / len(kanji_chars)
    length = 1.5 * (len(kanji_chars) - 1) if kind == "kun" else 1.5 * abs(len(kanji_chars) - 2)
    return (4 * max(0, hardest - own) + hardest + avg_freq / 400 + length + 0.3 * len(text)
            - 2 * math.log2(1 + contained_in.get(text, 0)))


def assign_words(words, study, lookup, freq):
    """Group candidate words under each study kanji by the reading used in the word: {char: {(kind, base): [(score, word)]}}."""
    usable = [(t, r, g) for t, r, g in words
              if len(t) <= cfg.MAX_WORD_LENGTH and any(is_kanji(c) for c in t)
              and all(c in study for c in t if is_kanji(c))]
    contained_in = productivity(t for t, _, _ in usable)
    groups = {char: {} for char in study}

    def add(char, key, score, word):
        bucket = groups[char].setdefault(key, [])
        if all(existing["w"] != word["w"] for _, existing in bucket):
            bucket.append((score, word))

    for text, reading, gloss in usable:
        kanji_chars = [c for c in text if is_kanji(c)]
        level = study[max(kanji_chars, key=lambda c: LEVEL_RANK[study[c]])]
        segments = align(text, reading, lookup)
        if segments is None:
            if len(text) >= 2 and len(kanji_chars) == len(text) and kata_to_hira(reading) == reading:
                for char in set(kanji_chars):
                    add(char, SPECIAL, word_score(text, char, "on", study, freq, contained_in),
                        {"w": text, "r": reading, "m": gloss, "lv": level})
            continue
        for index, start, end, kind, base in segments:
            char = text[index] if text[index] in study else text[index - 1]
            key = SPECIAL if kind == "extra" else (kind, base)
            add(char, key, word_score(text, char, kind, study, freq, contained_in),
                {"w": text, "r": reading, "m": gloss, "lv": level, "s": [start, end]})
    return groups


def ranked(bucket, limit):
    return [word for _, word in sorted(bucket, key=lambda item: (item[0], item[1]["w"]))[:limit]]


def pick_words(bucket, curated, limit):
    if curated is None:
        return ranked(bucket, limit)
    by_text = {word["w"]: word for _, word in bucket}
    return [by_text[text] for text in curated if text in by_text][:limit]


def reading_sections(entry, buckets, curated=None):
    curated = curated or {}
    on = []
    for reading in entry.get("readings_on") or []:
        base = reading.replace("-", "")
        words = pick_words(buckets.get(("on", base), []), curated.get("on", {}).get(base), cfg.WORDS_PER_ON_READING)
        on.append({"r": base, "words": words})
    kun, by_stem = [], {}
    for reading in entry.get("readings_kun") or []:
        stem, _, okuri = reading.replace("-", "").partition(".")
        if not stem:
            continue
        if stem not in by_stem:
            words = pick_words(buckets.get(("kun", stem), []), curated.get("kun", {}).get(stem), cfg.WORDS_PER_KUN_READING)
            by_stem[stem] = {"r": stem, "okuri": [], "words": words}
            kun.append(by_stem[stem])
        if okuri and okuri not in by_stem[stem]["okuri"]:
            by_stem[stem]["okuri"].append(okuri)
    special = pick_words(buckets.get(SPECIAL, []), curated.get("special"), cfg.WORDS_PER_KUN_READING)
    return on, kun, special


# ---------- parts, radicals, lessons ----------

def part_meaning(char, original, study_meanings, kanjidic):
    if char in study_meanings:
        return study_meanings[char]
    name = part_name(char, original) or (part_name(original) if original else None)
    if name:
        return name
    for candidate in (char, original):
        if candidate and kanjidic.get(candidate, {}).get("meanings"):
            return ", ".join(kanjidic[candidate]["meanings"][:2])
    return ""


def sound_reading(part, kanji_data):
    """On'yomi of a sound part in hiragana (e.g. 青 -> せい), so it can be compared with the kanji's reading."""
    for candidate in (part["c"], part["orig"]):
        readings = (kanji_data.get(candidate) or {}).get("readings_on") if candidate else None
        if readings:
            clean = list(dict.fromkeys(kata_to_hira(r.replace("-", "")) for r in readings))
            return "・".join(clean[:cfg.MAX_SOUND_READINGS])
    return None


def describe_parts(parts, study_meanings, kanjidic, kanji_data=None):
    described = []
    for part in parts:
        item = {"c": part["c"], "m": part_meaning(part["c"], part["orig"], study_meanings, kanjidic)}
        if part["orig"] and part["orig"] != part["c"]:
            item["base"] = part["orig"]
        if part["phon"]:
            item["sound"] = True
            reading = sound_reading(part, kanji_data or {})
            if reading:
                item["sr"] = reading
        described.append(item)
    return described


def describe_radical(char, kanjidic, radical_forms):
    number = kanjidic.get(char, {}).get("radical")
    entry = radical_by_number(number)
    if not entry:
        return None
    form, original = radical_forms.get(char, (None, None))
    radical = {"num": number, "char": entry[0], "name": entry[1]}
    if form and form != entry[0] and (original == entry[0] or part_name(form, original)):
        radical["form"] = form
    return radical


def study_parts(char, parts_by_kanji, sub_parts, study, _seen=None):
    """Study kanji that appear inside `char`, looking through non-study components."""
    seen = _seen if _seen is not None else set()
    found = []
    for part in parts_by_kanji.get(char) or sub_parts.get(char) or []:
        for candidate in (part["c"], part["orig"]):
            if not candidate or candidate in seen or candidate == char:
                continue
            seen.add(candidate)
            if candidate in study:
                found.append(candidate)
            else:
                found.extend(study_parts(candidate, {}, sub_parts, study, seen))
    return found


def order_lessons(study, parts_by_kanji, sub_parts, freq):
    """Order each level by frequency, but always put a kanji's parts before it."""
    lessons = {}
    for level in cfg.LEVELS:
        chars = sorted((c for c, lv in study.items() if lv == level), key=lambda c: (freq.get(c) or UNKNOWN_FREQ, c))
        ordered, placed = [], set()

        def visit(char, path):
            if char in placed or char in path:
                return
            path.add(char)
            for part in study_parts(char, parts_by_kanji, sub_parts, study):
                if study[part] == level:
                    visit(part, path)
            placed.add(char)
            ordered.append(char)

        for char in chars:
            visit(char, set())
        lessons[level] = [ordered[i:i + cfg.LESSON_SIZE] for i in range(0, len(ordered), cfg.LESSON_SIZE)]
    return lessons


def load_curated(directory):
    curated = {}
    for path in sorted(Path(directory).glob("*.json")):
        curated.update(json.loads(path.read_text(encoding="utf-8")))
    log.info("loaded curated entries for %d kanji from %s", len(curated), directory)
    return curated


# ---------- assemble ----------

def prepare(kanji_data, study, kanjidic, kvg, words):
    parts_by_kanji, sub_parts, _ = kvg
    freq = {c: (kanjidic.get(c) or {}).get("freq") for c in kanji_data}
    groups = assign_words(words, study, build_reading_lookup(kanji_data), freq)
    lessons = order_lessons(study, parts_by_kanji, sub_parts, freq)
    study_meanings = {c: (kanjidic.get(c, {}).get("meanings") or [""])[0] for c in study}
    return freq, groups, lessons, study_meanings


def assemble(kanji_data, study, kanjidic, kvg, words, curated):
    parts_by_kanji, sub_parts, radical_forms = kvg
    freq, groups, lessons, study_meanings = prepare(kanji_data, study, kanjidic, kvg, words)

    kanji = {}
    for level, level_lessons in lessons.items():
        for lesson_index, lesson in enumerate(level_lessons):
            for char in lesson:
                entry = kanji_data[char]
                on, kun, special = reading_sections(entry, groups[char], curated.get(char))
                record = {
                    "level": level,
                    "lesson": lesson_index + 1,
                    "strokes": entry.get("strokes"),
                    "meanings": (kanjidic.get(char, {}).get("meanings") or [m.lower() for m in entry["meanings"]])[:cfg.MAX_MEANINGS],
                    "radical": describe_radical(char, kanjidic, radical_forms),
                    "parts": describe_parts(parts_by_kanji.get(char, []), study_meanings, kanjidic, kanji_data),
                    "on": on,
                    "kun": kun,
                }
                if special:
                    record["special"] = special
                story = (curated.get(char) or {}).get("story")
                if story:
                    record["story"] = story
                kanji[char] = record

    components = {}
    for char, subs in sub_parts.items():
        if char in study:
            continue
        components[char] = {"m": part_meaning(char, None, study_meanings, kanjidic),
                            "parts": [p["c"] for p in subs if p["c"] != char]}
        bases = sorted({p["orig"] for p in subs if p["orig"]})
        if bases:
            components[char]["bases"] = bases

    return {
        "built": datetime.date.today().isoformat(),
        "levels": {level: {"count": sum(len(l) for l in lessons[level]), "lessons": lessons[level]} for level in cfg.LEVELS},
        "kanji": kanji,
        "components": components,
        "credits": [{k: s[k] for k in ("credit", "license", "home")} for s in cfg.SOURCES.values()],
    }


def curation_inputs(kanji_data, study, kanjidic, kvg, words):
    """Per-kanji shortlists for the curation pass, in lesson order."""
    parts_by_kanji = kvg[0]
    _, groups, lessons, study_meanings = prepare(kanji_data, study, kanjidic, kvg, words)
    items = []
    for level in cfg.LEVELS:
        for lesson in lessons[level]:
            for char in lesson:
                entry, buckets = kanji_data[char], groups[char]
                shortlist = lambda key: [[w["w"], w["r"], w["m"][:cfg.CANDIDATE_GLOSS_LENGTH]]
                                         for w in ranked(buckets.get(key, []), cfg.CANDIDATES_PER_READING)]
                kun_stems = list(dict.fromkeys(r.replace("-", "").partition(".")[0] for r in entry.get("readings_kun") or []))
                items.append({
                    "k": char,
                    "level": level,
                    "meanings": (kanjidic.get(char, {}).get("meanings") or [])[:cfg.MAX_MEANINGS],
                    "parts": [f"{p['c']} {p['m']}" for p in describe_parts(parts_by_kanji.get(char, []), study_meanings, kanjidic)],
                    "on": {r.replace("-", ""): shortlist(("on", r.replace("-", ""))) for r in entry.get("readings_on") or []},
                    "kun": {stem: shortlist(("kun", stem)) for stem in kun_stems if stem},
                    "special": shortlist(SPECIAL),
                })
    return items


def write_json(data, path, one_item_per_line=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if one_item_per_line:
        text = "[\n" + ",\n".join(json.dumps(item, ensure_ascii=False) for item in data) + "\n]\n"
    else:
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    log.info("wrote %s: %d bytes", path, len(text.encode("utf-8")))


def export_curation_inputs(items, directory, chunks):
    size = math.ceil(len(items) / chunks)
    for number in range(chunks):
        write_json(items[number * size:(number + 1) * size], directory / f"input-{number + 1}.json", one_item_per_line=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Build data/kanji.json from the downloaded datasets.")
    parser.add_argument("--export-curation", action="store_true", help="write word shortlists for the curation pass")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    kanji_data = json.loads(source_path("kanji-data").read_text(encoding="utf-8"))
    study = select_study_kanji(kanji_data)
    log.info("selected %d study kanji", len(study))
    kanjidic = load_kanjidic(source_path("kanjidic2"))
    kvg = load_kanjivg(source_path("kanjivg"), set(study))
    words = load_jmdict(source_path("jmdict"))

    if args.export_curation:
        export_curation_inputs(curation_inputs(kanji_data, study, kanjidic, kvg, words), cfg.CURATION_INPUT_DIR, cfg.CURATION_CHUNKS)
        return
    data = assemble(kanji_data, study, kanjidic, kvg, words, load_curated(cfg.CURATED_DIR))
    write_json(data, cfg.OUTPUT_FILE)
    log.info("built %d kanji", len(data["kanji"]))


if __name__ == "__main__":
    main()
