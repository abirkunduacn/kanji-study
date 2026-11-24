"""Local preview server for development: localhost only, with caching turned off so edits show on reload."""
import functools
import http.server
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_config as cfg  # noqa: E402

HOST = "127.0.0.1"
PORT = 8000
log = logging.getLogger("serve")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    handler = functools.partial(NoCacheHandler, directory=str(cfg.ROOT))
    with http.server.ThreadingHTTPServer((HOST, PORT), handler) as server:
        log.info("serving %s at http://%s:%d", cfg.ROOT, HOST, PORT)
        server.serve_forever()


if __name__ == "__main__":
    main()
