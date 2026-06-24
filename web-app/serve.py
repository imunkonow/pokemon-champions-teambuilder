"""serve.py — ローカル検証用の no-cache 静的サーバ。
編集→リロードが即反映されるよう Cache-Control:no-store を付与（python -m http.server だと
ブラウザが style.css?v=… を握って編集が反映されないため）。本番(GitHub Pages)では未使用。"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    HTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
