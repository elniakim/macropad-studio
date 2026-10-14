#!/usr/bin/env python3
"""Background agent: runs software actions (text, open, shell, macro) for the keypad.

The keypad sends a hidden trigger chord (e.g. ctrl-alt-shift-cmd-F13) for every
software slot. This agent catches those chords with a Quartz event tap, swallows
them so no app sees them, and runs the action from state/device.json (the mapping
that was last uploaded to the keypad).

Needs Accessibility permission for the app that launches it (Terminal / iTerm).
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

import AppKit
import Quartz as Q

import macropad as mp

ROOT = Path(__file__).resolve().parent
STATE = Path(os.environ.get("MACROPAD_STATE", ROOT / "state"))
DEVICE_FILE = STATE / "device.json"
STATUS_FILE = STATE / "agent.json"
MAGIC = 0x4D50_4144  # tags events we post ourselves so the tap ignores them
SYSTEM_DEFINED = 14  # NSEventTypeSystemDefined: how macOS delivers volume, playback and brightness keys
NX_MEDIA = {0: "volumeup", 1: "volumedown", 2: "screenbrightnessup", 3: "screenbrightnessdown", 7: "mute",
            16: "play", 17: "next", 18: "previous"}

MAC_KEYCODES = mp.MAC_KEYCODES
HID_TO_NAME = mp.HID_TO_NAME

MOD_FLAGS = [  # HID modifier bits (left|right) -> CG flag
    (0x11, Q.kCGEventFlagMaskControl),
    (0x22, Q.kCGEventFlagMaskShift),
    (0x44, Q.kCGEventFlagMaskAlternate),
    (0x88, Q.kCGEventFlagMaskCommand),
]
ALL_MODS = 0
for _, f in MOD_FLAGS:
    ALL_MODS |= f


def hid_mods_to_flags(mods: int) -> int:
    return sum(flag for bits, flag in MOD_FLAGS if mods & bits)


def flags_to_hid_mods(flags: int) -> int:
    # Left-side bits; trigger chords only use those.
    return sum(bits & 0x0F for bits, flag in MOD_FLAGS if flags & flag)


# --- output -----------------------------------------------------------------


def _post(ev):
    Q.CGEventSetIntegerValueField(ev, Q.kCGEventSourceUserData, MAGIC)
    Q.CGEventPost(Q.kCGHIDEventTap, ev)


def press_accord(accord: str):
    mods, code = mp._parse_accord(accord.strip().lower())
    flags = hid_mods_to_flags(mods)
    name = HID_TO_NAME.get(code)
    if code and name not in MAC_KEYCODES:
        raise ValueError(f"key {name or code!r} cannot be sent from macOS")
    kc = MAC_KEYCODES[name] if code else None
    if kc is None:
        return
    for down in (True, False):
        ev = Q.CGEventCreateKeyboardEvent(None, kc, down)
        Q.CGEventSetFlags(ev, flags)
        _post(ev)
        time.sleep(0.008)


def _utf16_chunks(text: str, limit: int = 20):
    """Split into pieces of at most `limit` UTF-16 units (the documented maximum
    for CGEventKeyboardSetUnicodeString) without splitting surrogate pairs."""
    chunk, units = "", 0
    for ch in text:
        n = 2 if ord(ch) > 0xFFFF else 1
        if units + n > limit:
            yield chunk
            chunk, units = "", 0
        chunk += ch
        units += n
    if chunk:
        yield chunk


def type_text(text: str):
    for line_i, line in enumerate(text.split("\n")):
        if line_i:
            press_accord("enter")
        for chunk in _utf16_chunks(line):
            for down in (True, False):
                ev = Q.CGEventCreateKeyboardEvent(None, 0, down)
                Q.CGEventKeyboardSetUnicodeString(ev, len(chunk.encode("utf-16-le")) // 2, chunk)
                _post(ev)
            time.sleep(0.01)


def open_target(target: str):
    target = os.path.expanduser(target.strip())
    if not target or target.startswith("-"):
        raise ValueError(f"refusing to open {target!r}")
    if "://" in target or target.startswith("/"):
        subprocess.Popen(["open", target])
    else:
        subprocess.Popen(["open", "-a", target])


def run_shell(command: str, wait: bool):
    p = subprocess.Popen(["/bin/zsh", "-lc", command], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if wait:
        p.wait()


def run_action(action: dict):
    t = action["type"]
    if t == "text":
        type_text(action.get("text", ""))
    elif t == "open":
        open_target(action.get("target", ""))
    elif t == "shell":
        run_shell(action.get("command", ""), wait=False)
    elif t == "macro":
        for step in action.get("steps", []):
            do, value = step.get("do"), step.get("value", "")
            repeat = max(1, int(step.get("repeat") or 1))
            for _ in range(repeat):
                if do == "keys":
                    for accord in value.split(","):
                        if accord.strip():
                            press_accord(accord)
                elif do == "text":
                    type_text(value)
                elif do == "wait":
                    time.sleep(int(step.get("ms") or value or 0) / 1000)
                elif do == "open":
                    open_target(value)
                elif do == "shell":
                    run_shell(value, wait=True)
                time.sleep(0.02)


# --- trigger handling -------------------------------------------------------


class Agent:
    def __init__(self):
        self.triggers: dict[tuple[int, int], dict] = {}
        self.mtime = 0.0
        self.swallow_up: set[int] = set()
        self.last = None
        self.media = None
        self.busy = threading.Lock()
        self.reload()

    def reload(self):
        try:
            mtime = DEVICE_FILE.stat().st_mtime
        except FileNotFoundError:
            self.triggers = {}
            return
        if mtime == self.mtime:
            return
        self.mtime = mtime
        mapping = json.loads(DEVICE_FILE.read_text())
        compiled = mp.compile_mapping(mapping)
        self.triggers = {}
        for key, action in compiled.triggers.items():
            mods, name = key.split(":")
            self.triggers[(int(mods), MAC_KEYCODES[name])] = action
        log(f"loaded {len(self.triggers)} software action(s)")
        self.write_status()

    def write_status(self):
        STATE.mkdir(exist_ok=True)
        tmp = STATUS_FILE.with_name(f".agent.{os.getpid()}.tmp")
        tmp.write_text(json.dumps({
            "pid": os.getpid(), "heartbeat": time.time(),
            "actions": len(self.triggers), "last": self.last, "media": self.media,
        }))
        tmp.replace(STATUS_FILE)  # atomic, so the server never reads half a file

    def fire(self, action: dict):
        self.last = {"layer": action["layer"], "slot": action["slot"], "at": time.time()}
        self.write_status()
        log(f"layer {action['layer'] + 1} {action['slot']}: {action['type']}")

        def work():
            with self.busy:
                time.sleep(0.05)  # let the trigger's modifiers release first
                try:
                    run_action(action)
                except Exception as e:  # keep the agent alive on bad actions
                    log(f"  failed: {e}")

        threading.Thread(target=work, daemon=True).start()

    def note_media(self, event):
        # Lets the editor show which media key or knob was just used; nothing else is recorded.
        ns = AppKit.NSEvent.eventWithCGEvent_(event)
        if ns is None or ns.subtype() != 8:
            return
        data = ns.data1()
        code = NX_MEDIA.get((data >> 16) & 0xFFFF)
        if code and (data >> 8) & 0xFF == 0x0A and not data & 1:  # key down, not auto-repeat
            self.media = {"code": code, "at": time.time()}
            self.write_status()

    def callback(self, proxy, etype, event, refcon):
        if etype in (Q.kCGEventTapDisabledByTimeout, Q.kCGEventTapDisabledByUserInput):
            Q.CGEventTapEnable(self.tap, True)
            return event
        if Q.CGEventGetIntegerValueField(event, Q.kCGEventSourceUserData) == MAGIC:
            return event
        if etype == SYSTEM_DEFINED:
            self.note_media(event)
            return event  # only observed, never swallowed
        kc = Q.CGEventGetIntegerValueField(event, Q.kCGKeyboardEventKeycode)
        if etype == Q.kCGEventKeyUp:
            if kc in self.swallow_up:
                self.swallow_up.discard(kc)
                return None
            return event
        mods = flags_to_hid_mods(Q.CGEventGetFlags(event) & ALL_MODS)
        action = self.triggers.get((mods, kc))
        if action is None:
            return event
        self.swallow_up.add(kc)
        if not Q.CGEventGetIntegerValueField(event, Q.kCGKeyboardEventAutorepeat):
            self.fire(action)
        return None

    def run(self):
        mask = Q.CGEventMaskBit(Q.kCGEventKeyDown) | Q.CGEventMaskBit(Q.kCGEventKeyUp) | Q.CGEventMaskBit(SYSTEM_DEFINED)
        self.tap = Q.CGEventTapCreate(Q.kCGSessionEventTap, Q.kCGHeadInsertEventTap,
                                      Q.kCGEventTapOptionDefault, mask, self.callback, None)
        if self.tap is None:
            sys.exit("Could not create event tap. Grant Accessibility permission to this terminal "
                     "(System Settings > Privacy & Security > Accessibility).")
        src = Q.CFMachPortCreateRunLoopSource(None, self.tap, 0)
        Q.CFRunLoopAddSource(Q.CFRunLoopGetCurrent(), src, Q.kCFRunLoopCommonModes)
        Q.CGEventTapEnable(self.tap, True)

        def tick(timer, info):
            try:
                self.reload()
            except Exception as e:
                log(f"reload failed: {e}")
            self.write_status()

        timer = Q.CFRunLoopTimerCreate(None, Q.CFAbsoluteTimeGetCurrent() + 1, 1.0, 0, 0, tick, None)
        Q.CFRunLoopAddTimer(Q.CFRunLoopGetCurrent(), timer, Q.kCFRunLoopCommonModes)
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, lambda *_: Q.CFRunLoopStop(Q.CFRunLoopGetMain()))
        log("agent running (Ctrl-C to stop)")
        try:
            Q.CFRunLoopRun()
        finally:
            STATUS_FILE.unlink(missing_ok=True)


def log(msg: str):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


if __name__ == "__main__":
    Agent().run()
