import hashlib
import logging
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_config as cfg  # noqa: E402

log = logging.getLogger("fetch_data")


def fetch(name, source, cache_dir=cfg.CACHE_DIR):
    target_dir = cache_dir / name
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / source["file"]
    if target.exists() and target.stat().st_size > 0:
        log.info("skip %s: already downloaded (%s)", name, target)
        return target
    log.info("download %s from %s", name, source["url"])
    request = urllib.request.Request(source["url"], headers={"User-Agent": "kanji-study-build"})
    with urllib.request.urlopen(request, timeout=cfg.DOWNLOAD_TIMEOUT_SECONDS) as response:
        data = response.read()
    target.write_bytes(data)
    log.info("saved %s: %d bytes, sha256 %s", target, len(data), hashlib.sha256(data).hexdigest())
    return target


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    for name, source in cfg.SOURCES.items():
        fetch(name, source)
    log.info("all sources ready in %s", cfg.CACHE_DIR)


if __name__ == "__main__":
    main()
