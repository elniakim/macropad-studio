#!/usr/bin/env python3
"""Local web UI for the macropad. Run `python server.py`; it opens the UI in your browser."""

from __future__ import annotations

import hmac
import json
import os
import secrets
import signal
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import macropad as mp

ROOT = Path(__file__).resolve().parent
STATE = Path(os.environ.get("MACROPAD_STATE", ROOT / "state"))
DRAFT_FILE = STATE / "mapping.json"
DEVICE_FILE = STATE / "device.json"
AGENT_STATUS = STATE / "agent.json"
AGENT_LOG = STATE / "agent.log"
TOKEN_FILE = STATE / "token"
UI_FILE = ROOT / "ui" / "index.html"
PORT = int(os.environ.get("MACROPAD_PORT", "8757"))

STARTER = {
    "rows": 3, "columns": 4, "knobs": 2,
    "layers": [
        {"led": "backlight white", "slots": {
            "b0": {"type": "keys", "steps": ["cmd-c"]},
            "b1": {"type": "keys", "steps": ["cmd-v"]},
            "b2": {"type": "keys", "steps": ["cmd-z"]},
            "b3": {"type": "keys", "steps": ["cmd-shift-z"]},
            "b4": {"type": "keys", "steps": ["cmd-shift-4"]},
            "b5": {"type": "keys", "steps": ["ctrl-left"]},
            "b6": {"type": "keys", "steps": ["ctrl-right"]},
            "b7": {"type": "keys", "steps": ["ctrl-up"]},
            "b8": {"type": "media", "code": "previous"},
            "b9": {"type": "media", "code": "play"},
            "b10": {"type": "media", "code": "next"},
            "b11": {"type": "keys", "steps": ["ctrl-cmd-q"]},
            "k0.ccw": {"type": "media", "code": "volumedown"},
            "k0.press": {"type": "media", "code": "mute"},
            "k0.cw": {"type": "media", "code": "volumeup"},
            "k1.ccw": {"type": "mouse", "action": "wheel", "delta": 1},
            "k1.press": {"type": "mouse", "action": "click", "buttons": ["middle"]},
            "k1.cw": {"type": "mouse", "action": "wheel", "delta": -1},
        }},
        {"led": "backlight blue", "slots": {}},
        {"led": "backlight purple", "slots": {}},
    ],
}

agent_proc: subprocess.Popen | None = None
device_lock = threading.Lock()


# --- state files ----------------------------------------------------------------


def ensure_state():
    STATE.mkdir(mode=0o700, exist_ok=True)
    STATE.chmod(0o700)  # also tighten a state/ dir created before this existed


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path: Path, data):
    ensure_state()
    fd, tmp = tempfile.mkstemp(dir=STATE, prefix=f".{path.name}.", suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def load_token() -> str:
    """A per-install secret the UI must send with every API call. It lives in a
    0600 file, so other accounts, sandboxed apps and containers that can reach
    127.0.0.1 still can't drive the API (which can run shell commands)."""
    ensure_state()
    try:
        return TOKEN_FILE.read_text().strip()
    except FileNotFoundError:
        token = secrets.token_urlsafe(32)
        fd = os.open(TOKEN_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(token)
        return token


TOKEN = ""


def load_mapping() -> tuple[dict, str | None]:
    raw = read_json(DRAFT_FILE)
    if raw is None:
        return STARTER, None
    try:
        return mp.normalize_mapping(raw), None
    except (ValueError, TypeError) as e:
        return STARTER, f"state/mapping.json is invalid ({e}); showing the starter mapping"


def load_uploaded() -> dict | None:
    try:
        return mp.normalize_mapping(read_json(DEVICE_FILE))
    except (ValueError, TypeError):
        return None


# --- helpers ----------------------------------------------------------------------


def device_info():
    try:
        devs = mp.find_devices()
    except Exception:
        devs = []
    return [{"id": f"{d['vendor_id']:04x}:{d['product_id']:04x}", "name": d["product_string"]} for d in devs]


def agent_status():
    st = read_json(AGENT_STATUS)
    running = bool(st) and time.time() - st.get("heartbeat", 0) < 5
    return {"running": running, "managed": agent_proc is not None and agent_proc.poll() is None,
            **(st or {})}


def catalog():
    return {
        "modifiers": ["ctrl", "shift", "alt", "cmd", "rctrl", "rshift", "ralt", "rcmd"],
        "keys": list(mp.KEYS),
        "media": list(dict.fromkeys(k for k in mp.MEDIA if k != "prev")),
        "led_modes": list(mp.LED_MODES),
        "led_colors": list(mp.LED_COLORS),
        "limits": {
            "layers": 3, "max_steps": 18, "max_delay": 6000,
            "software_slots": mp.MAX_SOFTWARE_SLOTS,
        },
    }


def list_apps():
    apps = set()
    for d in ["/Applications", "/System/Applications", os.path.expanduser("~/Applications"),
              "/Applications/Utilities", "/System/Applications/Utilities"]:
        try:
            apps.update(p[:-4] for p in os.listdir(d) if p.endswith(".app"))
        except OSError:
            pass
    return sorted(apps, key=str.lower)


def start_agent():
    global agent_proc
    if agent_status()["running"]:
        return
    ensure_state()
    log = open(AGENT_LOG, "a")
    agent_proc = subprocess.Popen([sys.executable, str(ROOT / "agent.py")], cwd=ROOT,
                                  stdout=log, stderr=subprocess.STDOUT)
    for _ in range(30):
        if agent_status()["running"] or agent_proc.poll() is not None:
            break
        time.sleep(0.1)
    if agent_proc.poll() is not None:
        raise RuntimeError("the agent exited: " + tail(AGENT_LOG))


def stop_agent():
    st = read_json(AGENT_STATUS) or {}
    pid = agent_proc.pid if agent_proc and agent_proc.poll() is None else st.get("pid")
    if pid:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    for _ in range(30):
        if not agent_status()["running"]:
            break
        time.sleep(0.1)
    AGENT_STATUS.unlink(missing_ok=True)


def tail(path: Path, n: int = 5) -> str:
    try:
        return "\n".join(path.read_text().splitlines()[-n:])
    except FileNotFoundError:
        return ""


# --- HTTP -----------------------------------------------------------------------------

ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def check(self, write: bool) -> int:
        """0 if the request may proceed, otherwise the HTTP status to refuse with.

        Host blocks DNS rebinding, Origin blocks other websites, the exact JSON
        content type forces a CORS preflight (which we never approve), and the
        token blocks local processes that aren't the user's own browser tab."""
        if self.headers.get("Host") not in ALLOWED_HOSTS:
            return 403
        origin = self.headers.get("Origin")
        if origin is not None and origin.removeprefix("http://") not in ALLOWED_HOSTS:
            return 403
        if not self.path.startswith("/api/"):
            return 0
        if write:
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if ctype != "application/json":
                return 403
        if not hmac.compare_digest(self.headers.get("X-Macropad-Token") or "", TOKEN):
            return 401
        return 0

    def reply(self, code: int, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def handle_method(self, write: bool, routes: dict):
        refused = self.check(write)
        if refused:
            return self.reply(refused, {"error": "forbidden" if refused == 403 else "unauthorized"})
        route = routes.get(self.path)
        if route is None:
            return self.reply(404, {"error": "not found"})
        try:
            route()
        except SystemExit as e:  # mp.send exits when no device is found
            self.reply(400, {"error": str(e)})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError, RuntimeError) as e:
            self.reply(400, {"error": str(e)})
        except Exception as e:  # never drop the connection without an answer
            self.reply(500, {"error": f"{type(e).__name__}: {e}"})

    def do_GET(self):
        self.handle_method(False, {
            "/": self.get_ui, "/index.html": self.get_ui,
            "/api/state": self.get_state, "/api/status": self.get_status, "/api/apps": self.get_apps,
        })

    def do_PUT(self):
        self.handle_method(True, {"/api/mapping": self.put_mapping})

    def do_POST(self):
        self.handle_method(True, {
            "/api/preview": self.post_preview, "/api/upload": self.post_upload, "/api/test": self.post_test,
            "/api/agent/start": self.post_agent_start, "/api/agent/stop": self.post_agent_stop,
        })

    # routes

    def get_ui(self):
        self.reply(200, UI_FILE.read_bytes(), "text/html; charset=utf-8")

    def get_state(self):
        mapping, warning = load_mapping()
        self.reply(200, {"mapping": mapping, "uploaded": load_uploaded(), "warning": warning,
                         "errors": mp.slot_errors(mapping), "catalog": catalog()})

    def get_status(self):
        self.reply(200, {"devices": device_info(), "agent": agent_status()})

    def get_apps(self):
        self.reply(200, list_apps())

    def put_mapping(self):
        mapping = mp.normalize_mapping(self.body())
        write_json(DRAFT_FILE, mapping)
        self.reply(200, {"errors": mp.slot_errors(mapping)})

    def post_preview(self):
        compiled = mp.compile_mapping(self.body())
        lines = [" ".join(f"{b:02x}" for b in p.rstrip(b"\0")) for p in compiled.packets]
        self.reply(200, {"packets": lines, "hardware": compiled.hardware_slots, "software": compiled.software_slots})

    def post_upload(self):
        mapping = mp.normalize_mapping(self.body())
        compiled = mp.compile_mapping(mapping)
        with device_lock:
            mp.send(compiled.packets)
        write_json(DRAFT_FILE, mapping)
        write_json(DEVICE_FILE, mapping)
        self.reply(200, {"packets": len(compiled.packets), "hardware": compiled.hardware_slots,
                         "software": compiled.software_slots})

    def post_test(self):
        import agent  # Quartz is only needed here

        action = mp.normalize_action(self.body())
        if action["type"] not in mp.SOFTWARE_TYPES:
            raise ValueError("only agent actions can be tested here")
        mp.check_software(action)
        threading.Thread(target=lambda: (time.sleep(1.5), agent.run_action(action)), daemon=True).start()
        self.reply(200, {"ok": True})

    def post_agent_start(self):
        start_agent()
        self.reply(200, agent_status())

    def post_agent_stop(self):
        stop_agent()
        self.reply(200, agent_status())


def main():
    global TOKEN
    TOKEN = load_token()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/#token={TOKEN}"
    print(f"Macropad Studio: {url}\n(Ctrl-C to stop)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
