"""Draw the app icon (字 in a practice square on blackboard green) as SVG and PNG, using only the standard library."""
import logging
import math
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_config as cfg  # noqa: E402

log = logging.getLogger("make_icons")

ICON_DIR = cfg.ROOT / "icons"
PNG_SIZES = {"icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180}
BOARD = (30, 90, 67)
CHALK = (244, 247, 242)
GUIDE = (74, 128, 104)
STROKE_WIDTH = 7.0
# Strokes of 字 on a 100 x 100 grid, kept inside the central 70% so maskable crops stay safe.
STROKES = [
    [(50, 17), (53, 26)],
    [(24, 31), (24, 40)],
    [(24, 31), (76, 31), (73, 39)],
    [(33, 49), (66, 49), (52, 60)],
    [(52, 60), (52, 82), (45, 79)],
    [(21, 66), (79, 66)],
]
GUIDES = [((50, 12), (50, 88)), ((12, 50), (88, 50))]


def svg_icon():
    strokes = "".join(
        f'<polyline points="{" ".join(f"{x},{y}" for x, y in stroke)}"/>' for stroke in STROKES)
    guides = "".join(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}"/>' for a, b in GUIDES)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<rect width="100" height="100" rx="18" fill="rgb{BOARD}"/>'
        f'<g stroke="rgb{GUIDE}" stroke-width="1.4" stroke-dasharray="4 4">{guides}</g>'
        f'<g fill="none" stroke="rgb{CHALK}" stroke-width="{STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">{strokes}</g>'
        "</svg>\n"
    )


def _segment_distance(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    t = 0.0 if length == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _segments(strokes):
    return [(a, b) for stroke in strokes for a, b in zip(stroke, stroke[1:])]


def render_pixels(size):
    """Return rows of RGB tuples for a full-bleed square icon."""
    scale = size / 100
    chalk_segments = _segments(STROKES)
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            px, py = (x + 0.5) / scale, (y + 0.5) / scale
            colour = BOARD
            guide = min(_segment_distance(px, py, *a, *b) for a, b in GUIDES)
            dashed = (px if abs(py - 50) < 1 else py) % 8 < 4
            if guide < 0.7 and dashed:
                colour = GUIDE
            distance = min(_segment_distance(px, py, *a, *b) for a, b in chalk_segments)
            coverage = max(0.0, min(1.0, (STROKE_WIDTH / 2 - distance) * scale + 0.5))
            if coverage > 0:
                colour = tuple(round(c * (1 - coverage) + k * coverage) for c, k in zip(colour, CHALK))
            row.append(colour)
        rows.append(row)
    return rows


def encode_png(rows):
    height, width = len(rows), len(rows[0])
    raw = b"".join(b"\x00" + bytes(channel for pixel in row for channel in pixel) for row in rows)

    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    ICON_DIR.mkdir(exist_ok=True)
    (ICON_DIR / "icon.svg").write_text(svg_icon(), encoding="utf-8")
    log.info("wrote %s", ICON_DIR / "icon.svg")
    for name, size in PNG_SIZES.items():
        (ICON_DIR / name).write_bytes(encode_png(render_pixels(size)))
        log.info("wrote %s (%dx%d)", ICON_DIR / name, size, size)


if __name__ == "__main__":
    main()
