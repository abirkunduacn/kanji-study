import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_config as cfg  # noqa: E402

log = logging.getLogger("check_curation")
LIMITS = {"on": cfg.WORDS_PER_ON_READING, "kun": cfg.WORDS_PER_KUN_READING, "special": cfg.WORDS_PER_KUN_READING}


def check(items, curated):
    """Return a list of problems in a curated chunk compared with its input shortlist."""
    problems = []
    expected = {item["k"]: item for item in items}
    for char in expected.keys() - curated.keys():
        problems.append(f"{char}: missing")
    for char in curated.keys() - expected.keys():
        problems.append(f"{char}: not in this input chunk")
    for char, entry in curated.items():
        item = expected.get(char)
        if not item:
            continue
        story = entry.get("story")
        if not isinstance(story, str) or not story.strip():
            problems.append(f"{char}: story missing")
        elif len(story) > cfg.MAX_STORY_LENGTH:
            problems.append(f"{char}: story is {len(story)} characters (max {cfg.MAX_STORY_LENGTH})")
        for kind in ("on", "kun"):
            for reading, picks in (entry.get(kind) or {}).items():
                if reading not in item[kind]:
                    problems.append(f"{char}: {kind} reading {reading} is not in the input")
                    continue
                problems.extend(_check_picks(char, f"{kind} {reading}", picks, item[kind][reading], LIMITS[kind]))
        if "special" in entry:
            problems.extend(_check_picks(char, "special", entry["special"], item["special"], LIMITS["special"]))
    return problems


def _check_picks(char, label, picks, candidates, limit):
    if not isinstance(picks, list):
        return [f"{char}: {label} must be a list"]
    allowed = {candidate[0] for candidate in candidates}
    problems = [f"{char}: {label} word {word} is not a candidate" for word in picks if word not in allowed]
    if len(picks) > limit:
        problems.append(f"{char}: {label} has {len(picks)} words (max {limit})")
    return problems


def main(input_path, curated_path):
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    items = json.loads(Path(input_path).read_text(encoding="utf-8"))
    curated = json.loads(Path(curated_path).read_text(encoding="utf-8"))
    problems = check(items, curated)
    for problem in problems:
        log.error(problem)
    log.info("%s: %d kanji checked, %d problems", curated_path, len(items), len(problems))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
