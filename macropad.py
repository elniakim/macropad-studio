#!/usr/bin/env python3
"""Programmer for CH57x-based AliExpress macro keypads (e.g. 12 keys + 2 knobs, 1189:8840).

Python re-implementation of the "ch57x-1" (k884x) protocol from
kriomant/ch57x-keyboard-tool (MIT). Talks to the vendor HID interface
(usage page 0xFF00, report id 3) through hidapi, so it works on macOS
without detaching kernel drivers.
"""

from __future__ import annotations

import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Optional, Union

# --- Key tables -------------------------------------------------------------

MODIFIERS = {  # name -> HID modifier bit
    "ctrl": 0x01, "shift": 0x02, "alt": 0x04, "opt": 0x04, "win": 0x08, "cmd": 0x08,
    "rctrl": 0x10, "rshift": 0x20, "ralt": 0x40, "ropt": 0x40, "rwin": 0x80, "rcmd": 0x80,
}

_KEY_ORDER = (
    [chr(c) for c in range(ord("a"), ord("z") + 1)]
    + list("1234567890")
    + ["enter", "escape", "backspace", "tab", "space", "minus", "equal", "leftbracket",
       "rightbracket", "backslash", "nonushash", "semicolon", "quote", "grave", "comma",
       "dot", "slash", "capslock"]
    + [f"f{i}" for i in range(1, 13)]
    + ["printscreen", "scrolllock", "pause", "insert", "home", "pageup", "delete", "end",
       "pagedown", "right", "left", "down", "up", "numlock", "numpadslash",
       "numpadasterisk", "numpadminus", "numpadplus", "numpadenter"]
    + [f"numpad{i}" for i in "1234567890"]
    + ["numpaddot", "nonusbackslash", "application", "power", "numpadequal"]
    + [f"f{i}" for i in range(13, 25)]
)
KEYS = {name: 0x04 + i for i, name in enumerate(_KEY_ORDER)}
KEY_ALIASES = {"esc": "escape", "macbrightnessdown": "scrolllock", "macbrightnessup": "pause"}

MEDIA = {
    "screenbrightnessup": 0x6F, "screenbrightnessdown": 0x70,
    "next": 0xB5, "previous": 0xB6, "prev": 0xB6, "stop": 0xB7, "play": 0xCD,
    "mute": 0xE2, "volumeup": 0xE9, "volumedown": 0xEA,
    "favorites": 0x182, "calculator": 0x192, "screenlock": 0x19E,
    "webpagehome": 0x223, "webpageback": 0x224, "webpageforward": 0x225,
}

MOUSE_MODIFIERS = {"ctrl": 0x01, "shift": 0x02, "alt": 0x04}
MOUSE_BUTTONS = {"left": 0x01, "right": 0x02, "middle": 0x04}
CLICK_ALIASES = {"click": "left", "lclick": "left", "rclick": "right", "mclick": "middle"}

KNOB_ACTIONS = {"ccw": 0, "press": 1, "cw": 2}

# --- Macro model ------------------------------------------------------------


@dataclass
class KeyboardMacro:
    accords: list[tuple[int, int]]  # (modifier bits, key code or 0)
    delay: int = 0


@dataclass
class MediaMacro:
    code: int


@dataclass
class MouseMacro:
    action: str  # click | move | drag | wheel
    modifier: int = 0
    buttons: int = 0
    dx: int = 0
    dy: int = 0
    delta: int = 0


Macro = Union[KeyboardMacro, MediaMacro, MouseMacro]


class ParseError(ValueError):
    pass


def _delta(s: str) -> int:
    v = int(s)
    if not -128 <= v <= 127:
        raise ParseError(f"value out of range -128..127: {v}")
    return v


def _buttons(s: str) -> int:
    bits = 0
    for b in s.split("+"):
        if b not in MOUSE_BUTTONS:
            raise ParseError(f"unknown mouse button: {b!r}")
        bits |= MOUSE_BUTTONS[b]
    return bits


_NUM = r"(-?\d+)"


def _parse_mouse(s: str) -> Optional[MouseMacro]:
    modifier = 0
    m = re.fullmatch(r"(ctrl|shift|alt)-(.+)", s)
    if m:
        modifier, s = MOUSE_MODIFIERS[m[1]], m[2]

    if m2 := re.fullmatch(rf"move\({_NUM},{_NUM}\)", s):
        return MouseMacro("move", modifier, dx=_delta(m2[1]), dy=_delta(m2[2]))
    if m2 := re.fullmatch(rf"drag\(([a-z+]+),{_NUM},{_NUM}\)", s):
        return MouseMacro("drag", modifier, buttons=_buttons(m2[1]), dx=_delta(m2[2]), dy=_delta(m2[3]))
    if m2 := re.fullmatch(rf"wheel\({_NUM}\)", s):
        return MouseMacro("wheel", modifier, delta=_delta(m2[1]))
    if s in ("wheelup", "wheeldown"):
        return MouseMacro("wheel", modifier, delta=1 if s == "wheelup" else -1)
    if m2 := re.fullmatch(r"click\(([a-z+]+)\)", s):
        return MouseMacro("click", modifier, buttons=_buttons(m2[1]))
    parts = s.split("+")
    if all(p in CLICK_ALIASES for p in parts):
        return MouseMacro("click", modifier, buttons=_buttons("+".join(CLICK_ALIASES[p] for p in parts)))
    return None


def _parse_code(s: str) -> Optional[int]:
    if m := re.fullmatch(r"<(\d+)>", s):
        v = int(m[1])
        if v > 255:
            raise ParseError(f"custom key code out of range: {v}")
        return v
    return KEYS.get(KEY_ALIASES.get(s, s))


def _parse_accord(s: str) -> tuple[int, int]:
    parts = s.split("-")
    mods = 0
    for p in parts[:-1]:
        if p not in MODIFIERS:
            raise ParseError(f"unknown modifier {p!r} in {s!r}")
        mods |= MODIFIERS[p]
    last = parts[-1]
    code = _parse_code(last)
    if code is not None:
        return mods, code
    if last in MODIFIERS:
        return mods | MODIFIERS[last], 0
    raise ParseError(f"unknown key {last!r} in {s!r}")


def parse_macro(text: str) -> Macro:
    s = str(text).strip().lower()
    if not s:
        raise ParseError("empty macro")
    if (mouse := _parse_mouse(s)) is not None:
        return mouse
    if s in MEDIA:
        return MediaMacro(MEDIA[s])
    if m := re.fullmatch(r"consumer\((0x[0-9a-f]+|\d+)\)", s):
        code = int(m[1], 0)
        if not 0 < code <= 0xFFFF:
            raise ParseError(f"consumer code out of range: {code}")
        return MediaMacro(code)

    delay = 0
    if m := re.fullmatch(r"\{([^}]*)\}(.+)", s):
        for opt in filter(None, m[1].split(",")):
            if not (d := re.fullmatch(r"delay\((\d+)\)", opt)):
                raise ParseError(f"unknown option {opt!r}")
            delay = int(d[1])
        s = m[2]
    return KeyboardMacro([_parse_accord(a) for a in s.split(",")], delay)


# --- Protocol (ch57x-1 / k884x) ---------------------------------------------

PACKET = 64


def _packet(*data: int) -> bytes:
    return bytes(data).ljust(PACKET, b"\0")


@dataclass
class Layout:
    buttons: int = 12
    knobs: int = 2

    def __post_init__(self):
        if not ((self.buttons <= 15 and self.knobs <= 3) or (self.buttons <= 12 and self.knobs <= 4)):
            raise ValueError("unsupported combination of buttons and knobs count")

    def button_id(self, n: int) -> int:
        if n >= 15 or (n >= 12 and self.knobs == 4):
            raise ValueError(f"invalid button index {n}")
        return n + 1

    def knob_id(self, n: int, action: int) -> int:
        # 12-button models with a 4th knob reuse the codes of buttons 13-15.
        if n == 3 and self.buttons <= 12:
            return 13 + action
        if n >= 3:
            raise ValueError(f"invalid knob index {n}")
        return 16 + 3 * n + action


def encode_bind(key_id: int, layer: int, macro: Macro) -> list[bytes]:
    if not 0 <= layer <= 15:
        raise ValueError("invalid layer index")
    head = [0x03, 0xFE, key_id, layer + 1]

    if isinstance(macro, KeyboardMacro):
        if len(macro.accords) > 18:
            raise ValueError("macro sequence is too long")
        # A lone modifier (no key) is sent with count 0 so it combines with other keys.
        count = 0 if len(macro.accords) == 1 and macro.accords[0][1] == 0 else len(macro.accords)
        body = [1, 0, 0, 0, 0, 0, count]
        for mods, code in macro.accords:
            body += [mods, code]
    elif isinstance(macro, MediaMacro):
        body = [2, 0, 0, 0, 0, 0, 0, macro.code & 0xFF, macro.code >> 8]
    else:
        prefix = [3, 0, 0, 0, 0, 0]
        m = macro
        if m.action == "click":
            if not m.buttons:
                raise ValueError("buttons must be given for click macro")
            body = prefix + [0x01, m.modifier, m.buttons]
        elif m.action in ("move", "drag"):
            body = prefix + [0x05, m.modifier, m.buttons, m.dx & 0xFF, m.dy & 0xFF]
        else:
            body = prefix + [0x03, m.modifier, 0, 0, 0, m.delta & 0xFF]

    packets = [_packet(*head, *body)]
    if isinstance(macro, KeyboardMacro) and macro.delay:
        if macro.delay > 6000:
            raise ValueError("maximum supported delay is 6000ms")
        packets.append(_packet(*head, 5, macro.delay & 0xFF, macro.delay >> 8))
    packets += [
        _packet(0x03, 0xAA, 0xAA),
        _packet(0x03, 0xFD, 0xFE, 0xFF),
        _packet(0x03, 0xAA, 0xAA),
    ]
    return packets


LED_COLORS = {"white": 0, "red": 1, "orange": 2, "yellow": 3, "green": 4, "cyan": 5, "blue": 6, "purple": 7}
LED_MODES = {"off": 0, "backlight": 1, "shock": 2, "shock2": 3, "press": 4}


def led_code(mode: str, color: Optional[str] = None) -> int:
    if mode == "off":
        return 0
    if mode not in LED_MODES:
        raise ValueError(f"unknown LED mode {mode!r}; use one of {', '.join(LED_MODES)}")
    if color not in LED_COLORS:
        raise ValueError(f"unknown LED color {color!r}; use one of {', '.join(LED_COLORS)}")
    if color == "white":
        if mode != "backlight":
            raise ValueError("white is only available for backlight mode")
        return 0x05
    return (LED_COLORS[color] << 4) | LED_MODES[mode]


def encode_led(layer: int, code: int) -> list[bytes]:
    if not 0 <= layer <= 2:
        raise ValueError("layer must be 0-2")
    return [
        _packet(0x03, 0xFE, 0xB0, layer + 1, 0x08, 0, 0, 0, 0, 0, 0x01, 0, code),
        _packet(0x03, 0xFD, 0xFE, 0xFF),
    ]


# --- Config -----------------------------------------------------------------

ORIENTATIONS = ("normal", "upsidedown", "clockwise", "counterclockwise")


@dataclass
class FlatLayer:
    buttons: list[Optional[Macro]]
    knobs: list[dict[str, Optional[Macro]]] = field(default_factory=list)


@dataclass
class Config:
    rows: int
    columns: int
    knobs: int
    layers: list[FlatLayer]

    @property
    def layout(self) -> Layout:
        return Layout(self.rows * self.columns, self.knobs)


def _reorient_grid(orientation: str, rows: int, cols: int, grid: list[list]) -> list:
    def tr(r, c):
        if orientation == "normal":
            return r, c
        if orientation == "upsidedown":
            return rows - r - 1, cols - c - 1
        if orientation == "clockwise":
            return c, rows - r - 1
        return cols - c - 1, r

    out = []
    for i in range(rows * cols):
        r, c = tr(i // cols, i % cols)
        out.append(grid[r][c])
    return out


def _opt_macro(v) -> Optional[Macro]:
    return None if v is None else parse_macro(v)


def load_config(data: dict) -> Config:
    model = data.get("model")
    if model not in (None, "ch57x-1"):
        raise ValueError(f"only model 'ch57x-1' is supported, got {model!r}")
    orientation = data.get("orientation", "normal")
    if orientation not in ORIENTATIONS:
        raise ValueError(f"orientation must be one of {ORIENTATIONS}")
    rows, cols, nknobs = int(data["rows"]), int(data["columns"]), int(data["knobs"])
    orows, ocols = (rows, cols) if orientation in ("normal", "upsidedown") else (cols, rows)
    limited = (rows == 1 or cols == 1) and nknobs == 1

    layers = []
    for i, layer in enumerate(data["layers"]):
        grid = layer.get("buttons", [])
        if len(grid) != orows or any(len(row) != ocols for row in grid):
            raise ValueError(f"layer {i}: buttons must be {orows} rows x {ocols} columns")
        knobs = layer.get("knobs") or []
        if len(knobs) != nknobs:
            raise ValueError(f"layer {i}: expected {nknobs} knobs, got {len(knobs)}")
        try:
            parsed = [[_opt_macro(v) for v in row] for row in grid]
            pknobs = [{a: _opt_macro((k or {}).get(a)) for a in KNOB_ACTIONS} for k in knobs]
        except ParseError as e:
            raise ValueError(f"layer {i}: {e}") from None
        buttons = _reorient_grid(orientation, rows, cols, parsed)
        if orientation in ("upsidedown", "clockwise"):
            pknobs.reverse()
        if limited:
            for m in buttons:
                if isinstance(m, KeyboardMacro) and any(mods for mods, _ in m.accords[1:]):
                    raise ValueError("1-row keyboard with 1 knob supports modifiers on the first key only")
        layers.append(FlatLayer(buttons, pknobs))
    cfg = Config(rows, cols, nknobs, layers)
    cfg.layout  # validates button/knob combination
    return cfg


def render_packets(cfg: Config) -> list[bytes]:
    layout = cfg.layout
    packets: list[bytes] = []
    for li, layer in enumerate(cfg.layers):
        for bi, m in enumerate(layer.buttons):
            if m is not None:
                packets += encode_bind(layout.button_id(bi), li, m)
        for ki, knob in enumerate(layer.knobs):
            for action, idx in KNOB_ACTIONS.items():
                if knob[action] is not None:
                    packets += encode_bind(layout.knob_id(ki, idx), li, knob[action])
    return packets


# --- JSON mapping (used by the web UI and the agent) ------------------------
#
# {"rows": 3, "columns": 4, "knobs": 2,
#  "layers": [{"led": "backlight white",
#              "slots": {"b0": <action>, ..., "k0.ccw": <action>, "k0.press": ..., "k0.cw": ...}}]}
#
# Hardware actions are stored in the keypad itself:
#   {"type": "keys",  "steps": ["cmd-c", "cmd-v"], "delay": 0}
#   {"type": "media", "code": "volumeup" | 0xE9}
#   {"type": "mouse", "action": "click|move|drag|wheel", "buttons": ["left"],
#    "modifier": "ctrl|shift|alt|", "dx": 0, "dy": 0, "delta": 1}
#   {"type": "raw",   "expr": "{delay(50)}ctrl-a,b"}       original tool syntax
# Software actions are run by agent.py; the keypad sends a hidden trigger chord:
#   {"type": "text",  "text": "Hello, 안녕하세요 👋"}
#   {"type": "open",  "target": "/Applications/Slack.app" | "https://..."}
#   {"type": "shell", "command": "say hi"}
#   {"type": "macro", "steps": [{"do": "keys", "value": "cmd-c"}, {"do": "wait", "ms": 200},
#                               {"do": "text", "value": "..."}, {"do": "open", "value": "..."},
#                               {"do": "shell", "value": "..."}]}

HARDWARE_TYPES = {"keys", "media", "mouse", "raw"}
SOFTWARE_TYPES = {"text", "open", "shell", "macro"}
MACRO_STEPS = {"keys", "text", "wait", "open", "shell"}

# Trigger chords for software actions: F13-F20 (macOS has no F21-F24 keycodes)
# combined with 3+ modifiers, which nothing else realistically uses.
TRIGGER_KEYS = ["f16", "f17", "f18", "f19", "f20", "f13", "f14", "f15"]  # F14/F15 last: brightness on some Macs
TRIGGER_MODS = [0x0F, 0x07, 0x0D, 0x0B, 0x0E]  # hyper, ctrl-alt-shift, ctrl-alt-cmd, ctrl-shift-cmd, alt-shift-cmd
MAX_SOFTWARE_SLOTS = len(TRIGGER_KEYS) * len(TRIGGER_MODS)
_TRIGGER_CODES = {KEYS[k] for k in TRIGGER_KEYS}

# Key that clears a slot: a keyboard macro with no keys. Every slot is written on
# upload so nothing stale (e.g. an old trigger chord) is left on the keypad.
NOOP = KeyboardMacro([(0, 0)])

# HID key name -> macOS virtual keycode. Keys missing here can be stored on the
# keypad but can't be sent by the agent.
MAC_KEYCODES = {
    "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11,
    "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21,
    "6": 22, "5": 23, "equal": 24, "9": 25, "7": 26, "minus": 27, "8": 28, "0": 29,
    "rightbracket": 30, "o": 31, "u": 32, "leftbracket": 33, "i": 34, "p": 35, "enter": 36,
    "l": 37, "j": 38, "quote": 39, "k": 40, "semicolon": 41, "backslash": 42, "comma": 43,
    "slash": 44, "n": 45, "m": 46, "dot": 47, "tab": 48, "space": 49, "grave": 50,
    "backspace": 51, "escape": 53, "capslock": 57, "f17": 64, "numpaddot": 65,
    "numpadasterisk": 67, "numpadplus": 69, "numlock": 71, "numpadslash": 75,
    "numpadenter": 76, "numpadminus": 78, "f18": 79, "f19": 80, "numpadequal": 81,
    "numpad0": 82, "numpad1": 83, "numpad2": 84, "numpad3": 85, "numpad4": 86, "numpad5": 87,
    "numpad6": 88, "numpad7": 89, "f20": 90, "numpad8": 91, "numpad9": 92, "f5": 96, "f6": 97,
    "f7": 98, "f3": 99, "f8": 100, "f9": 101, "f11": 103, "f13": 105, "f16": 106, "f14": 107,
    "f10": 109, "f12": 111, "f15": 113, "insert": 114, "home": 115, "pageup": 116,
    "delete": 117, "f4": 118, "end": 119, "f2": 120, "pagedown": 121, "f1": 122, "left": 123,
    "right": 124, "down": 125, "up": 126,
}
HID_TO_NAME = {code: name for name, code in KEYS.items()}


def trigger(i: int) -> tuple[int, str]:
    if i >= MAX_SOFTWARE_SLOTS:
        raise ValueError(f"too many agent actions (max {MAX_SOFTWARE_SLOTS})")
    return TRIGGER_MODS[i // len(TRIGGER_KEYS)], TRIGGER_KEYS[i % len(TRIGGER_KEYS)]


def slot_names(rows: int, columns: int, knobs: int) -> list[str]:
    return [f"b{i}" for i in range(rows * columns)] + [
        f"k{k}.{a}" for k in range(knobs) for a in KNOB_ACTIONS
    ]


# --- schema ------------------------------------------------------------------
# Mappings come from the browser and from hand-edited files, so everything is
# checked and rebuilt from known fields; anything else is dropped.


def _int(v, lo: int, hi: int, what: str) -> int:
    if isinstance(v, bool) or not isinstance(v, (int, float, str)):
        raise ValueError(f"{what} must be a number")
    try:
        n = int(v)
    except ValueError:
        raise ValueError(f"{what} must be a number") from None
    if not lo <= n <= hi:
        raise ValueError(f"{what} must be between {lo} and {hi}")
    return n


def _str(v, what: str, limit: int = 10_000) -> str:
    if v is None:
        return ""
    if not isinstance(v, str):
        raise ValueError(f"{what} must be text")
    if len(v) > limit:
        raise ValueError(f"{what} is too long")
    return v


def normalize_action(a) -> dict:
    if not isinstance(a, dict):
        raise ValueError("action must be an object")
    t = a.get("type")
    if t not in HARDWARE_TYPES | SOFTWARE_TYPES:
        raise ValueError(f"unknown action type {t!r}")
    out: dict = {"type": t}
    if a.get("label"):
        out["label"] = _str(a["label"], "label", 60)
    if t == "keys":
        steps = a.get("steps") or []
        if not isinstance(steps, list) or len(steps) > 18:
            raise ValueError("steps must be a list of at most 18 keys")
        out["steps"] = [_str(s, "key", 60) for s in steps]
        out["delay"] = _int(a.get("delay") or 0, 0, 6000, "delay")
    elif t == "media":
        code = a.get("code")
        out["code"] = _int(code, 1, 0xFFFF, "media code") if isinstance(code, int) else _str(code, "media code", 20)
    elif t == "mouse":
        action = a.get("action")
        if action not in ("click", "move", "drag", "wheel"):
            raise ValueError(f"unknown mouse action {action!r}")
        buttons = a.get("buttons") or []
        if not isinstance(buttons, list) or any(b not in MOUSE_BUTTONS for b in buttons):
            raise ValueError("mouse buttons must be left/right/middle")
        mod = a.get("modifier") or ""
        if mod and mod not in MOUSE_MODIFIERS:
            raise ValueError("mouse modifier must be ctrl, shift or alt")
        out.update(action=action, buttons=list(dict.fromkeys(buttons)), modifier=mod,
                   dx=_int(a.get("dx") or 0, -128, 127, "dx"), dy=_int(a.get("dy") or 0, -128, 127, "dy"),
                   delta=_int(a.get("delta") or 0, -128, 127, "scroll amount"))
    elif t == "raw":
        out["expr"] = _str(a.get("expr"), "expression", 500)
    elif t == "text":
        out["text"] = _str(a.get("text"), "text")
    elif t == "open":
        out["target"] = _str(a.get("target"), "target", 2000)
    elif t == "shell":
        out["command"] = _str(a.get("command"), "command")
    elif t == "macro":
        steps = a.get("steps") or []
        if not isinstance(steps, list) or len(steps) > 500:
            raise ValueError("macro steps must be a list")
        out["steps"] = []
        for st in steps:
            if not isinstance(st, dict) or st.get("do") not in MACRO_STEPS:
                raise ValueError("unknown macro step")
            if st["do"] == "wait":
                out["steps"].append({"do": "wait", "ms": _int(st.get("ms") or 0, 0, 600_000, "wait")})
            else:
                out["steps"].append({"do": st["do"], "value": _str(st.get("value"), "step"),
                                     "repeat": _int(st.get("repeat") or 1, 1, 999, "repeat")})
    return out


def normalize_mapping(m) -> dict:
    if not isinstance(m, dict):
        raise ValueError("mapping must be an object")
    rows = _int(m.get("rows"), 1, 15, "rows")
    cols = _int(m.get("columns"), 1, 15, "columns")
    knobs = _int(m.get("knobs"), 0, 4, "knobs")
    Layout(rows * cols, knobs)  # validates the combination
    layers = m.get("layers")
    if not isinstance(layers, list) or not 1 <= len(layers) <= 3:
        raise ValueError("the keypad has 1-3 layers")
    names = set(slot_names(rows, cols, knobs))
    out_layers = []
    for layer in layers:
        if not isinstance(layer, dict):
            raise ValueError("layer must be an object")
        out: dict = {"slots": {}}
        if layer.get("name"):
            out["name"] = _str(layer["name"], "layer name", 60)
        if layer.get("led"):
            led = _str(layer["led"], "LED mode", 30)
            words = led.split()
            led_code(words[0], words[1] if len(words) > 1 else None)
            out["led"] = led
        slots = layer.get("slots") or {}
        if not isinstance(slots, dict):
            raise ValueError("slots must be an object")
        for name, action in slots.items():
            if name not in names:
                raise ValueError(f"unknown slot {name!r}")
            if action is not None:
                out["slots"][name] = normalize_action(action)
        out_layers.append(out)
    return {"rows": rows, "columns": cols, "knobs": knobs, "layers": out_layers}


# --- per-action checks ---------------------------------------------------------


def _check_not_trigger(macro: Macro):
    if isinstance(macro, KeyboardMacro):
        for mods, code in macro.accords:
            if ((mods | mods >> 4) & 0x0F) in TRIGGER_MODS and code in _TRIGGER_CODES:
                raise ValueError("this shortcut is reserved for agent triggers")


def hardware_macro(action: dict) -> Macro:
    t = action["type"]
    if t == "keys":
        steps = [s.strip().lower() for s in action.get("steps", []) if s.strip()]
        if not steps:
            raise ParseError("add at least one key")
        macro: Macro = KeyboardMacro([_parse_accord(s) for s in steps], int(action.get("delay") or 0))
    elif t == "media":
        code = action["code"]
        if isinstance(code, int):
            macro = MediaMacro(code)
        else:
            m = parse_macro(code if code in MEDIA else f"consumer({code})")
            assert isinstance(m, MediaMacro)
            macro = m
    elif t == "mouse":
        a = action["action"]
        buttons = 0
        if a in ("click", "drag"):
            for b in action.get("buttons") or []:
                buttons |= MOUSE_BUTTONS[b]
        if a == "click" and not buttons:
            raise ParseError("pick at least one mouse button")
        macro = MouseMacro(a, MOUSE_MODIFIERS.get(action.get("modifier") or "", 0), buttons,
                           _delta(action.get("dx", 0)), _delta(action.get("dy", 0)), _delta(action.get("delta", 0)))
    elif t == "raw":
        macro = parse_macro(action["expr"])
    else:
        raise ParseError(f"unknown action type {t!r}")
    _check_not_trigger(macro)
    return macro


def _check_open_target(target: str):
    # `open` would read a leading "-" as one of its own options.
    if not target.strip():
        raise ValueError("choose something to open")
    if target.strip().startswith("-"):
        raise ValueError("an open target can't start with '-'")


def check_software(action: dict):
    """Raise if the agent couldn't perform this action."""
    if action["type"] == "open":
        _check_open_target(action["target"])
    if action["type"] != "macro":
        return
    for st in action["steps"]:
        if st["do"] == "open":
            _check_open_target(st["value"])
        if st["do"] != "keys":
            continue
        accords = [a.strip().lower() for a in st["value"].split(",") if a.strip()]
        if not accords:
            raise ValueError("a key step needs at least one key")
        for accord in accords:
            _, code = _parse_accord(accord)
            name = HID_TO_NAME.get(code)
            if name not in MAC_KEYCODES:
                raise ValueError(f"{accord!r} can't be sent from macOS")


def check_action(action: dict, layer: int):
    if action["type"] in SOFTWARE_TYPES:
        check_software(action)
    else:
        encode_bind(1, layer, hardware_macro(action))


def slot_errors(mapping: dict) -> dict[str, str]:
    """Every problem keyed by "layer:slot", so the UI can mark each bad key."""
    errors: dict[str, str] = {}
    sw = 0
    names = slot_names(mapping["rows"], mapping["columns"], mapping["knobs"])
    for li, layer in enumerate(mapping["layers"]):
        for name in names:
            action = layer["slots"].get(name)
            if not action:
                continue
            try:
                if action["type"] in SOFTWARE_TYPES:
                    sw += 1
                    if sw > MAX_SOFTWARE_SLOTS:
                        raise ValueError(f"too many agent actions (max {MAX_SOFTWARE_SLOTS})")
                check_action(action, li)
            except (ParseError, ValueError, KeyError) as e:
                errors[f"{li}:{name}"] = str(e)
    return errors


@dataclass
class Compiled:
    packets: list[bytes]
    triggers: dict[str, dict]  # "mods:key" -> software action (with "slot"/"layer" for display)
    hardware_slots: int
    software_slots: int


def compile_mapping(mapping: dict) -> Compiled:
    mapping = normalize_mapping(mapping)
    layout = Layout(mapping["rows"] * mapping["columns"], mapping["knobs"])
    names = slot_names(mapping["rows"], mapping["columns"], mapping["knobs"])
    packets: list[bytes] = []
    triggers: dict[str, dict] = {}
    hw = sw = 0

    for li, layer in enumerate(mapping["layers"]):
        for name in names:
            action = layer["slots"].get(name)
            if name.startswith("b"):
                key_id = layout.button_id(int(name[1:]))
            else:
                k, a = name[1:].split(".")
                key_id = layout.knob_id(int(k), KNOB_ACTIONS[a])
            try:
                if not action:
                    macro: Macro = NOOP
                elif action["type"] in SOFTWARE_TYPES:
                    check_software(action)
                    mods, key = trigger(sw)
                    triggers[f"{mods}:{key}"] = {**action, "layer": li, "slot": name}
                    macro = KeyboardMacro([(mods, KEYS[key])])
                    sw += 1
                else:
                    macro = hardware_macro(action)
                    hw += 1
                packets += encode_bind(key_id, li, macro)
            except (ParseError, ValueError, KeyError) as e:
                raise ValueError(f"layer {li + 1} {name}: {e}") from None
        if layer.get("led"):
            words = layer["led"].split()
            packets += encode_led(li, led_code(words[0], words[1] if len(words) > 1 else None))
    return Compiled(packets, triggers, hw, sw)


# --- Device -----------------------------------------------------------------

SUPPORTED_IDS = [(0x1189, 0x8840), (0x1189, 0x8842), (0x1189, 0x8850), (0x514C, 0x8851)]
VENDOR_USAGE_PAGE = 0xFF00

# hidapi's macOS backend binds its IOHIDManager to the run loop of the thread
# that imports `hid`, and crashes once that thread is gone (the web server uses
# a thread per request). Import and call hidapi only on one long-lived thread.
_HID_THREAD = ThreadPoolExecutor(max_workers=1, thread_name_prefix="hid")


def find_devices():
    return _HID_THREAD.submit(_find_devices).result(timeout=10)


def _find_devices():
    import hid

    return [
        d for vid, pid in SUPPORTED_IDS
        for d in hid.enumerate(vid, pid)
        if d["usage_page"] == VENDOR_USAGE_PAGE
    ]


def send(packets: list[bytes], path: Optional[bytes] = None) -> None:
    _HID_THREAD.submit(_send, packets, path).result(timeout=30)


def _send(packets: list[bytes], path: Optional[bytes]) -> None:
    import hid

    if path is None:
        found = _find_devices()  # already on the HID thread
        if not found:
            sys.exit("CH57x keypad not found (looked for 1189:8840/8842/8850, 514c:8851).")
        if len(found) > 1:
            sys.exit("Several keypads found; pass --path. Use `list` to see them.")
        path = found[0]["path"]

    dev = hid.device()
    dev.open_path(path)
    try:
        # Init: one all-zero packet. The leading 0 is hidapi's "no report id" marker.
        _write(dev, b"\0" + bytes(PACKET))
        for p in packets:
            _write(dev, p)  # p[0] == 0x03 is the report id
    finally:
        dev.close()


def _write(dev, data: bytes) -> None:
    n = dev.write(data)
    if n < 0:
        raise OSError(f"HID write failed: {dev.error()}")


# --- CLI --------------------------------------------------------------------


def _hexdump(packets: list[bytes]) -> None:
    for p in packets:
        print(" ".join(f"{b:02x}" for b in p.rstrip(b"\0") or b"\0"))


def _load_yaml(path: str) -> Config:
    import yaml

    with (sys.stdin if path == "-" else open(path)) as f:
        return load_config(yaml.safe_load(f))


def cmd_list(_):
    devs = find_devices()
    if not devs:
        print("No CH57x keypad found.")
    for d in devs:
        print(f"{d['vendor_id']:04x}:{d['product_id']:04x}  {d['product_string']!r}  path={d['path'].decode()}")


def cmd_show_keys(_):
    print("Modifiers:", ", ".join(MODIFIERS))
    print("\nKeys:", ", ".join(_KEY_ORDER))
    print("Aliases:", ", ".join(f"{a}={k}" for a, k in KEY_ALIASES.items()))
    print("Custom HID code: <101>")
    print("\nMedia:", ", ".join(MEDIA))
    print("\nMouse: click, rclick, mclick, click(left+right), move(5,0), drag(left,0,5),")
    print("       wheel(-3), wheelup, wheeldown  (prefix with ctrl-/shift-/alt-)")
    print("\nKeyboard macro options: {delay(100)}a,b,c")


def cmd_validate(args):
    cfg = _load_yaml(args.config)
    n = len(render_packets(cfg))
    print(f"config is valid: {len(cfg.layers)} layer(s), {n} packets")


def cmd_upload(args):
    packets = render_packets(_load_yaml(args.config))
    if args.dry_run:
        _hexdump(packets)
        return
    send(packets, args.path and args.path.encode())
    print(f"uploaded {len(packets)} packets")


def cmd_led(args):
    words = args.mode.lower().split()
    packets = encode_led(args.layer, led_code(words[0], words[1] if len(words) > 1 else None))
    if args.dry_run:
        _hexdump(packets)
        return
    send(packets, args.path and args.path.encode())
    print("LED mode set")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--path", help="HID device path (from `list`) when several keypads are attached")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="list connected keypads").set_defaults(fn=cmd_list)
    sub.add_parser("show-keys", help="list key / media / mouse names").set_defaults(fn=cmd_show_keys)

    p = sub.add_parser("validate", help="check a mapping YAML")
    p.add_argument("config", help="YAML file, or - for stdin")
    p.set_defaults(fn=cmd_validate)

    p = sub.add_parser("upload", help="write a mapping YAML to the keypad")
    p.add_argument("config", help="YAML file, or - for stdin")
    p.add_argument("--dry-run", action="store_true", help="print packets instead of sending")
    p.set_defaults(fn=cmd_upload)

    p = sub.add_parser("led", help="set LED mode for a layer")
    p.add_argument("layer", type=int, help="layer 0-2")
    p.add_argument("mode", help="'off', 'backlight <color>', 'shock <color>', 'shock2 <color>', 'press <color>'")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(fn=cmd_led)

    args = ap.parse_args(argv)
    try:
        args.fn(args)
    except (ValueError, OSError) as e:
        sys.exit(f"error: {e}")


if __name__ == "__main__":
    main()
