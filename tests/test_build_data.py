import datetime
import io
import json
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import align  # noqa: E402
import build_data as bd  # noqa: E402
import check_curation  # noqa: E402
import kana  # noqa: E402
import make_icons  # noqa: E402
import radicals  # noqa: E402

LOG_DIR = ROOT / "tests" / "logs"

READINGS = {
    "学": {"readings_on": ["がく"], "readings_kun": ["まな.ぶ"]},
    "校": {"readings_on": ["こう"], "readings_kun": []},
    "一": {"readings_on": ["いち", "いつ"], "readings_kun": ["ひと-", "ひと.つ"]},
    "本": {"readings_on": ["ほん"], "readings_kun": ["もと"]},
    "休": {"readings_on": ["きゅう"], "readings_kun": ["やす.む", "やす.まる"]},
    "人": {"readings_on": ["じん", "にん"], "readings_kun": ["ひと", "-り", "-と"]},
    "今": {"readings_on": ["こん", "きん"], "readings_kun": ["いま"]},
    "日": {"readings_on": ["にち", "じつ"], "readings_kun": ["ひ", "-び", "-か"]},
    "売": {"readings_on": ["ばい"], "readings_kun": ["う.る", "う.れる"]},
    "場": {"readings_on": ["じょう"], "readings_kun": ["ば"]},
}


def lookup(extra=None):
    return bd.build_reading_lookup(READINGS, extra if extra is not None else {})


class TestKana(unittest.TestCase):
    def test_KAN001_katakana_becomes_hiragana(self):
        """Katakana readings are converted to hiragana and other text is left alone."""
        self.assertEqual(kana.kata_to_hira("キュウ"), "きゅう")
        self.assertEqual(kana.kata_to_hira("休む"), "休む")

    def test_KAN002_kanji_and_kana_are_told_apart(self):
        """is_kanji is true for kanji only and is_kana for hiragana and katakana."""
        self.assertTrue(kana.is_kanji("休"))
        self.assertFalse(kana.is_kanji("や"))
        self.assertTrue(kana.is_kana("ヤ"))

    def test_KAN003_sound_changes_inside_words(self):
        """Voicing applies after the first character and small tsu before a following character."""
        middle = dict(kana.sound_variants("かく", is_first=False, is_last=False))
        self.assertIn("がく", middle)
        self.assertIn("かっ", middle)
        first = dict(kana.sound_variants("かく", is_first=True, is_last=True))
        self.assertEqual(first, {"かく": 0})

    def test_KAN004_unwritten_okurigana_includes_verb_stems(self):
        """A godan verb ending also yields its i-stem (売る gives 売り)."""
        self.assertIn("り", kana.okurigana_prefixes("る"))
        self.assertEqual(kana.okurigana_prefixes(""), [])


class TestAlign(unittest.TestCase):
    def test_ALN001_compound_with_small_tsu(self):
        """学校 がっこう aligns 学 to がっ via its on reading がく."""
        segments = align.align("学校", "がっこう", lookup())
        self.assertEqual(segments[0], (0, 0, 2, "on", "がく"))
        self.assertEqual(segments[1][3:], ("on", "こう"))

    def test_ALN002_handakuten_after_small_tsu(self):
        """一本 いっぽん reads 本 as ぽん."""
        segments = align.align("一本", "いっぽん", lookup())
        self.assertEqual([s[4] for s in segments], ["いち", "ほん"])

    def test_ALN003_kun_reading_with_okurigana(self):
        """休む aligns 休 to the kun stem やす and leaves む as kana."""
        self.assertEqual(align.align("休む", "やすむ", lookup()), [(0, 0, 2, "kun", "やす")])

    def test_ALN004_irregular_reading_fails(self):
        """今日 きょう cannot be split character by character."""
        self.assertIsNone(align.align("今日", "きょう", lookup()))

    def test_ALN005_repeat_mark_uses_previous_kanji(self):
        """人々 ひとびと reads the repeat mark as a voiced ひと."""
        segments = align.align("人々", "ひとびと", lookup())
        self.assertEqual([s[4] for s in segments], ["ひと", "ひと"])

    def test_ALN006_absorbed_okurigana(self):
        """売場 うりば works even though the り of 売り is not written."""
        segments = align.align("売場", "うりば", lookup())
        self.assertEqual(segments[0][3:], ("kun", "う"))

    def test_ALN007_extra_readings_are_marked(self):
        """An extra reading such as に for 日 aligns 日本 and is flagged as extra."""
        segments = align.align("日本", "にほん", lookup({"日": ["に"]}))
        self.assertEqual(segments[0][3], "extra")
        self.assertIsNone(align.align("日本", "にほん", lookup()))


class TestRadicals(unittest.TestCase):
    def test_RAD001_radical_numbers(self):
        """Radical 9 is person and numbers outside 1-214 return None."""
        self.assertEqual(radicals.radical_by_number(9), ("人", "person"))
        self.assertIsNone(radicals.radical_by_number(0))
        self.assertIsNone(radicals.radical_by_number(215))

    def test_RAD002_variant_and_split_forms(self):
        """氵 is water and 阝 depends on its full form."""
        self.assertEqual(radicals.part_name("氵"), "water")
        self.assertEqual(radicals.part_name("阝", "阜"), "hill")
        self.assertEqual(radicals.part_name("阝", "邑"), "town")
        self.assertIsNone(radicals.part_name("吾"))

    def test_RAD003_table_has_all_kangxi_radicals(self):
        """The table lists exactly 214 radicals."""
        self.assertEqual(len(radicals.KANGXI) - 1, 214)


KANJIVG_SAMPLE = """<kanjivg xmlns:kvg='http://kanjivg.tagaini.net'>
<kanji id="kvg:kanji_08a9e"><g id="kvg:08a9e" kvg:element="語">
  <g kvg:element="言" kvg:radical="general"><g kvg:element="口"/></g>
  <g kvg:element="吾" kvg:phon="吾"><g kvg:element="五"/><g kvg:element="口"/></g>
</g></kanji>
<kanji id="kvg:kanji_056fd"><g id="kvg:056fd" kvg:element="国">
  <g kvg:element="囗" kvg:part="1" kvg:radical="general"/>
  <g><g kvg:element="玉"/></g>
  <g kvg:element="囗" kvg:part="2" kvg:radical="general"/>
</g></kanji>
<kanji id="kvg:kanji_04f11-Kaisho"><g kvg:element="休"/></kanji>
</kanjivg>"""


class TestBuildData(unittest.TestCase):
    def setUp(self):
        self.study = {"学": "N5", "校": "N5", "一": "N5", "本": "N5", "休": "N5", "人": "N5", "今": "N5", "日": "N5", "売": "N4", "場": "N4"}
        self.freq = {char: i * 10 for i, char in enumerate(self.study)}

    def test_BLD001_select_study_kanji(self):
        """Only kanji with an N5-N2 level are kept, labelled with their level."""
        data = {"日": {"jlpt_new": 5}, "森": {"jlpt_new": 2}, "鬱": {"jlpt_new": 1}, "々": {}}
        self.assertEqual(bd.select_study_kanji(data), {"日": "N5", "森": "N2"})

    def test_BLD002_kanjivg_parts(self):
        """Parts come from the top level, split parts merge, wrapper groups open, variants are skipped."""
        root = ET.fromstring(KANJIVG_SAMPLE)
        parts, subs, forms = bd.parse_kanjivg_tree(root, {"語", "国", "休"})
        self.assertEqual([p["c"] for p in parts["語"]], ["言", "吾"])
        self.assertTrue(parts["語"][1]["phon"])
        self.assertEqual([p["c"] for p in parts["国"]], ["囗", "玉"])
        self.assertEqual([p["c"] for p in subs["吾"]], ["五", "口"])
        self.assertEqual(forms["語"], ("言", None))
        self.assertNotIn("休", parts)

    def test_BLD003_jmdict_candidates(self):
        """The first common spelling is used and words tagged usually-kana are skipped."""
        sense = lambda misc, text: {"misc": misc, "gloss": [{"text": text}]}
        words = [
            {"kanji": [{"common": False, "text": "學校", "tags": []}, {"common": True, "text": "学校", "tags": []}],
             "kana": [{"text": "がっこう", "tags": [], "appliesToKanji": ["*"]}], "sense": [sense([], "school")]},
            {"kanji": [{"common": True, "text": "為る", "tags": []}],
             "kana": [{"text": "する", "tags": [], "appliesToKanji": ["*"]}], "sense": [sense(["uk"], "to do")]},
        ]
        self.assertEqual(list(bd.jmdict_candidates(words)), [("学校", "がっこう", "school")])

    def test_BLD004_words_grouped_by_reading(self):
        """Words go under the reading used in them; unsplittable words become special readings."""
        words = [("学校", "がっこう", "school"), ("学ぶ", "まなぶ", "to learn"), ("今日", "きょう", "today"), ("休日", "きゅうじつ", "holiday")]
        groups = bd.assign_words(words, self.study, lookup(), self.freq)
        self.assertEqual([w["w"] for _, w in groups["学"][("on", "がく")]], ["学校"])
        self.assertEqual([w["w"] for _, w in groups["学"][("kun", "まな")]], ["学ぶ"])
        self.assertEqual([w["w"] for _, w in groups["今"][bd.SPECIAL]], ["今日"])
        self.assertEqual(groups["日"][("on", "じつ")][0][1]["s"], [3, 5])

    def test_BLD005_lessons_put_parts_first(self):
        """A kanji's parts in the same level are placed before it, even if less frequent."""
        study = {"休": "N5", "人": "N5", "木": "N5"}
        parts = {"休": [{"c": "亻", "orig": "人", "phon": False}, {"c": "木", "orig": None, "phon": False}], "人": [], "木": []}
        lessons = bd.order_lessons(study, parts, {}, {"休": 1, "人": 50, "木": 90})
        self.assertEqual(lessons["N5"], [["人", "木", "休"]])

    def test_BLD006_curated_picks_replace_ranking(self):
        """Curated words keep their order, unknown words are ignored and None falls back to ranking."""
        bucket = [(1.0, {"w": "A"}), (2.0, {"w": "B"}), (3.0, {"w": "C"})]
        self.assertEqual([w["w"] for w in bd.pick_words(bucket, ["C", "Z", "A"], 3)], ["C", "A"])
        self.assertEqual([w["w"] for w in bd.pick_words(bucket, None, 2)], ["A", "B"])
        self.assertEqual(bd.pick_words(bucket, [], 2), [])

    def test_BLD007_kun_readings_grouped_by_stem(self):
        """Kun readings sharing a stem are shown once with every okurigana."""
        _, kun, _ = bd.reading_sections(READINGS["休"], {})
        self.assertEqual(kun, [{"r": "やす", "okuri": ["む", "まる"], "words": []}])

    def test_BLD008_curated_files_are_merged(self):
        """Every JSON file in the curated folder is loaded."""
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, "part-1.json").write_text(json.dumps({"日": {"story": "a"}}), encoding="utf-8")
            Path(folder, "part-2.json").write_text(json.dumps({"月": {"story": "b"}}), encoding="utf-8")
            self.assertEqual(set(bd.load_curated(folder)), {"日", "月"})

    def test_BLD010_radical_notes_removed_from_meanings(self):
        """Dictionary notes like "one radical (no.1)" are dropped, but never every meaning."""
        self.assertEqual(bd.clean_meanings(["one", "one radical (no.1)"]), ["one"])
        self.assertEqual(bd.clean_meanings(["kettle lid radical (no. 8)"]), ["kettle lid radical (no. 8)"])

    def test_BLD011_sound_parts_carry_their_reading(self):
        """A sound part gets its on'yomi in hiragana; other parts and unknown characters get none."""
        kanji_data = {"青": {"readings_on": ["せい", "しょう", "じょう"]}, "日": {"readings_on": ["にち"]}}
        parts = [{"c": "日", "orig": None, "phon": False}, {"c": "青", "orig": None, "phon": True}, {"c": "龶", "orig": None, "phon": True}]
        described = bd.describe_parts(parts, {}, {}, kanji_data)
        self.assertNotIn("sr", described[0])
        self.assertEqual(described[1]["sr"], "せい・しょう")
        self.assertTrue(described[2]["sound"])
        self.assertNotIn("sr", described[2])

    def test_BLD009_productivity_counts_containing_words(self):
        """A word contained in longer words scores higher."""
        counts = bd.productivity(["大学", "大学生", "大学院", "学生"])
        self.assertEqual(counts["大学"], 2)
        self.assertEqual(counts["学生"], 1)


class TestCheckCuration(unittest.TestCase):
    def setUp(self):
        self.items = [{"k": "休", "on": {"きゅう": [["休日", "きゅうじつ", "holiday"]]}, "kun": {"やす": [["休む", "やすむ", "to rest"]]}, "special": []}]

    def test_CUR001_valid_chunk_passes(self):
        """A complete chunk with candidate words only has no problems."""
        curated = {"休": {"story": "A **person** rests.", "on": {"きゅう": ["休日"]}, "kun": {"やす": ["休む"]}, "special": []}}
        self.assertEqual(check_curation.check(self.items, curated), [])

    def test_CUR002_problems_are_reported(self):
        """Missing kanji, invented words, extra kanji and long stories are all caught."""
        curated = {"林": {"story": "x"}, "休": {"story": "y" * 500, "on": {"きゅう": ["休憩"]}}}
        problems = "\n".join(check_curation.check(self.items + [{"k": "日", "on": {}, "kun": {}, "special": []}], curated))
        for text in ("日: missing", "林: not in this input chunk", "休憩 is not a candidate", "story is 500 characters"):
            self.assertIn(text, problems)


class TestIcons(unittest.TestCase):
    def test_ICO001_png_header(self):
        """The PNG encoder writes a valid signature and the right size."""
        data = make_icons.encode_png(make_icons.render_pixels(16))
        self.assertTrue(data.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertEqual(int.from_bytes(data[16:20], "big"), 16)

    def test_ICO002_svg_draws_every_stroke(self):
        """The SVG icon has one polyline per stroke."""
        self.assertEqual(make_icons.svg_icon().count("<polyline"), len(make_icons.STROKES))


class _Tee(io.TextIOBase):
    def __init__(self, *streams):
        self.streams = streams

    def write(self, text):
        for stream in self.streams:
            stream.write(text)
        return len(text)

    def flush(self):
        for stream in self.streams:
            if not stream.closed:
                stream.flush()


def main():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"python-tests-{datetime.datetime.now():%Y%m%d-%H%M%S}.log"
    with open(log_path, "w", encoding="utf-8") as log_file:
        runner = unittest.TextTestRunner(stream=_Tee(sys.stderr, log_file), verbosity=2)
        result = runner.run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    print(f"Log saved to {log_path}")
    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    main()
