from functools import lru_cache

from kana import REPEAT_MARK, is_kana, is_kanji, kata_to_hira, okurigana_prefixes, sound_variants

# Small costs that break ties between equally valid alignments.
KUN_IN_COMPOUND_COST = 0.3
ON_BEFORE_OKURIGANA_COST = 0.3
ABSORBED_OKURIGANA_COST = 0.2


def reading_options(readings_on, readings_kun, extra=()):
    """All ways a kanji can be read: (kana, type, base reading, cost)."""
    options = [(kata_to_hira(r), "extra", r, 0.5) for r in extra]
    for reading in readings_on or []:
        base = kata_to_hira(reading.replace("-", ""))
        if base:
            options.append((base, "on", base, 0.0))
    for reading in readings_kun or []:
        clean = reading.replace("-", "")
        stem, _, okuri = clean.partition(".")
        if not stem:
            continue
        options.append((stem, "kun", stem, 0.0))
        for prefix in okurigana_prefixes(okuri):
            options.append((stem + prefix, "kun", stem, ABSORBED_OKURIGANA_COST))
    return options


def align(text, reading, lookup):
    """Split a word's reading across its characters.

    Returns a list of segments (index, start, end, type, base) for each kanji,
    or None when the reading cannot be explained character by character.
    """
    reading = kata_to_hira(reading)
    chars = list(text)
    kanji_count = sum(1 for c in chars if is_kanji(c))
    has_kana = any(is_kana(c) for c in chars)

    @lru_cache(maxsize=None)
    def best(i, j):
        if i == len(chars):
            return (0.0, ()) if j == len(reading) else None
        ch = chars[i]
        if is_kana(ch):
            if reading.startswith(kata_to_hira(ch), j):
                return best(i + 1, j + 1)
            return None
        source = chars[i - 1] if ch == REPEAT_MARK and i > 0 else ch
        if not is_kanji(source):
            return None
        is_first = i == 0
        is_last = i == len(chars) - 1
        next_is_kana = not is_last and is_kana(chars[i + 1])
        result = None
        for kana, kind, base, cost in lookup.get(source, ()):
            extra = cost
            if kind == "kun" and kanji_count >= 2 and not has_kana:
                extra += KUN_IN_COMPOUND_COST
            if kind == "on" and next_is_kana:
                extra += ON_BEFORE_OKURIGANA_COST
            for variant, variant_cost in sound_variants(kana, is_first, is_last):
                if not reading.startswith(variant, j):
                    continue
                rest = best(i + 1, j + len(variant))
                if rest is None:
                    continue
                total = extra + variant_cost + rest[0]
                if result is None or total < result[0]:
                    segment = (i, j, j + len(variant), kind, base)
                    result = (total, (segment,) + rest[1])
        return result

    found = best(0, 0)
    return list(found[1]) if found else None
