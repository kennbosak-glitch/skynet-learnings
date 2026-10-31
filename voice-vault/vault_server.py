#!/data/data/com.termux/files/usr/bin/python3
"""Skynet Voice Vault server.

Serves files from the vault dir (this script's directory) on port 8099,
ONLY under the /<TOKEN>/ path prefix. No directory listing, no traversal.
Supports GET/HEAD and single-range requests (206) for media players.
"""
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

TOKEN = "YOUR-TOKEN-HERE"  # set your own secret path token
PORT = 8099
VAULT_DIR = os.path.dirname(os.path.abspath(__file__))

MIME = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
}


class VaultHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stderr.flush()

    def _resolve(self):
        """Return absolute file path for the request, or None to 404."""
        path = unquote(urlsplit(self.path).path)
        prefix = "/" + TOKEN + "/"
        if not path.startswith(prefix):
            return None
        rel = path[len(prefix):]
        if not rel or rel.endswith("/"):
            return None
        full = os.path.normpath(os.path.join(VAULT_DIR, rel))
        if os.path.commonpath([full, VAULT_DIR]) != VAULT_DIR:
            return None
        if not os.path.isfile(full):
            return None
        return full

    def _serve(self, head_only):
        full = self._resolve()
        if full is None:
            body = b"not found"
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if not head_only:
                self.wfile.write(body)
            return
        size = os.path.getsize(full)
        start, end = 0, size - 1
        status = 200
        range_hdr = self.headers.get("Range")
        if range_hdr and range_hdr.startswith("bytes="):
            try:
                spec = range_hdr[6:].split(",", 1)[0]
                a, _, b = spec.partition("-")
                if a and b:
                    start, end = int(a), int(b)
                elif a:
                    start = int(a)
                elif b:
                    start = max(0, size - int(b))
                end = min(end, size - 1)
                if start > end or start >= size:
                    raise ValueError
                status = 206
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", "bytes */%d" % size)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        length = end - start + 1
        ext = os.path.splitext(full)[1].lower()
        self.send_response(status)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.end_headers()
        if head_only:
            return
        with open(full, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def do_GET(self):
        self._serve(False)

    def do_HEAD(self):
        self._serve(True)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), VaultHandler)
    sys.stderr.write("vault server on 0.0.0.0:%d dir=%s token-prefix=/%s/\n"
                     % (PORT, VAULT_DIR, TOKEN))
    sys.stderr.flush()
    server.serve_forever()
