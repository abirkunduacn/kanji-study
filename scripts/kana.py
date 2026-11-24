REPEAT_MARK = "々"

_VOICED = {
    "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
    "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
    "た": "だ", "ち": "ぢじ", "つ": "づず", "て": "で", "と": "ど",
    "は": "ばぱ", "ひ": "びぴ", "ふ": "ぶぷ", "へ": "べぺ", "ほ": "ぼぽ",
}
_GEMINATING_ENDINGS = "つちくき"
# Godan verb endings and their stem forms (売る -> 売り), used when okurigana is left unwritten.
_GODAN_STEM = {"う": "い", "く": "き", "ぐ": "ぎ", "す": "し", "つ": "ち", "ぬ": "に", "ぶ": "び", "む": "み", "る": "り"}


def okurigana_prefixes(okuri):
    """Kana a reading may absorb when its okurigana is not written (受付 = 受け + 付け)."""
    prefixes = [okuri[:i] for i in range(1, len(okuri) + 1)]
    if okuri and okuri[-1] in _GODAN_STEM:
        prefixes.append(okuri[:-1] + _GODAN_STEM[okuri[-1]])
    return list(dict.fromkeys(prefixes))


def kata_to_hira(text):
    return "".join(chr(ord(ch) - 0x60) if 0x30A1 <= ord(ch) <= 0x30F6 else ch for ch in text)


def is_kana(ch):
    return 0x3041 <= ord(ch) <= 0x309F or 0x30A0 <= ord(ch) <= 0x30FF


def is_kanji(ch):
    code = ord(ch)
    return (0x4E00 <= code <= 0x9FFF or 0x3400 <= code <= 0x4DBF
            or 0xF900 <= code <= 0xFAFF or 0x20000 <= code <= 0x2FFFF)


def sound_variants(kana, is_first, is_last):
    """Spellings a kanji reading can take inside a word, each with a cost (0 = as written)."""
    yield kana, 0
    voiced_starts = [] if is_first else list(_VOICED.get(kana[0], ""))
    for start in voiced_starts:
        yield start + kana[1:], 1
    if not is_last and len(kana) >= 2 and kana[-1] in _GEMINATING_ENDINGS:
        yield kana[:-1] + "っ", 1
        for start in voiced_starts:
            if len(kana) >= 3:
                yield start + kana[1:-1] + "っ", 2
