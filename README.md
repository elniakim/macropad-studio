# Macropad Studio

A macOS configurator for the cheap **CH57x-based macro keypads** sold on AliExpress and Amazon
(12 keys + 2 knobs, USB ID `1189:8840`, and relatives). The vendor software is Windows-only and
can't even show you the current mapping. Macropad Studio gives you a native-feeling editor, a key
recorder, and a small background agent that lets a key do things the keypad hardware can't —
type any text, open apps, run shell commands, or play back multi-step macros.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshot-dark.png">
  <img alt="Macropad Studio editing a macro on a 12-key, 2-knob keypad" src="docs/screenshot-light.png">
</picture>

## Features

- **Visual editor** for all 3 layers: 12 keys and 2 knobs (turn left, press, turn right). Drag keys to
  swap them, copy and paste slots, and set each layer's LED mode and colour.
- **Key recorder** — press a shortcut on your keyboard and it's captured.
- **Everything the hardware supports**: key sequences, media keys, mouse click/scroll/move/drag, and
  the original tool's expression syntax for power users.
- **Agent actions** for what the hardware can't do (see below): type any Unicode text (emoji,
  Korean, …), open apps, URLs and files, run shell commands, and macros with per-step waits and repeats.
- Light and dark mode; English and Korean UI (follows your browser language).
- A CLI that reads the original tool's YAML format.

## Requirements

- macOS (tested on macOS 26, Apple silicon) and Python 3.10+
- A keypad that speaks the "ch57x-1" protocol: `1189:8840`, `1189:8842`, `1189:8850` or `514c:8851`.
  Run `python macropad.py list` to check.

## Quick start

```sh
git clone https://github.com/elniakim/macropad-studio.git
cd macropad-studio
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```

`server.py` opens the editor in your browser using a private link
(`http://127.0.0.1:8757/#token=…`); keep using that link or bookmark it. Pick a key, choose what it
should do, then press **Upload to keypad** — it takes well under a second.

The CLI accepts the original tool's YAML format:

```sh
.venv/bin/python macropad.py list
.venv/bin/python macropad.py validate mapping.yaml
.venv/bin/python macropad.py upload mapping.yaml --dry-run   # print the USB packets
.venv/bin/python macropad.py led 0 "backlight blue"
```

## What the hardware can and can't do

| | Limit |
|---|---|
| Layers | 3, switched with the button on the side. Each layer has its own LED mode |
| Slots | 12 keys + 2 knobs × (left, press, right) = 18 per layer, 54 in total |
| Key sequence | Up to 18 steps of "modifiers + one key". One delay (0–6000 ms) applies between *all* steps |
| Media | One HID Consumer usage per slot — volume, playback, brightness, or any raw code |
| Mouse | Click (any button combination), scroll ±127, move/drag ±127 px; at most one modifier (control, shift or option — no command) |
| Not possible | Typing text, a different wait per step, repeats, hold vs. tap, launching apps |

Hardware actions live on the keypad and work on any computer, with or without this app.
The keypad can't report its current mapping, so every upload rewrites all 54 slots; empty slots
are cleared rather than left with whatever was there before.

## The Mac agent

For everything in the "not possible" row, Macropad Studio stores a **hidden trigger chord** on the
keypad (for example ⌃⌥⇧⌘F16) and runs a small agent (`agent.py`) that catches that chord with a
Quartz event tap, swallows it so no app sees it, and performs the real action.

- Toggle it with **Mac agent** in the toolbar. Agent slots do nothing while it's off, and only work on
  the Mac running it.
- Up to 40 agent slots (F13–F20 combined with five 3–4-modifier sets). Those chords are reserved,
  so a hardware key can't be set to one of them.
- The app that launches the agent (Terminal, iTerm, …) needs **Accessibility** permission:
  System Settings → Privacy & Security → Accessibility.
- Use **Run test** in the editor to try an agent action without touching the keypad.

## Security

The editor can make your Mac run shell commands, so the local server is locked down:

- It listens on `127.0.0.1` only and checks the `Host` and `Origin` headers, so other websites (and
  DNS-rebinding tricks) can't reach it.
- Every API call must carry a random token stored in `state/token` (mode `0600`, inside a `0700`
  directory). Other user accounts, sandboxed apps and containers that can reach localhost still can't
  drive it.
- Writes must be `application/json`, which forces a CORS preflight that is never approved; pages
  can't be framed (`frame-ancestors 'none'`).
- Mappings are validated against a strict schema before they're saved, and everything the UI
  renders is escaped.

What remains is the point of the feature: a mapping's shell actions run as you. Only use mappings you
wrote or trust. The agent sees key events in order to catch its trigger chords, but only acts on —
and only logs — those chords.

## How it works

The keypad exposes a vendor HID interface (usage page `0xFF00`, report ID 3). Configuration is a
series of 64-byte reports: one bind report per slot, plus a short commit sequence and optional LED
reports. On macOS that interface belongs to the system's HID driver, so this project uses **hidapi**
rather than libusb, and runs every hidapi call on one long-lived thread (hidapi's macOS backend is
tied to the run loop of the thread that first loads it).

```
ui/index.html ──JSON──▶ server.py ──compile──▶ macropad.py ──hidapi──▶ keypad
                            │
                            └─ state/device.json ──▶ agent.py (Quartz event tap)
```

| File | Role |
|---|---|
| `macropad.py` | Protocol encoder, expression parser, mapping schema and compiler, CLI |
| `server.py` | Local web server and JSON API |
| `ui/index.html` | The editor — one file, no build step |
| `agent.py` | Runs agent actions when trigger chords arrive |
| `state/` | Your draft, the last uploaded mapping and the API token (git-ignored) |

## Development

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

The tests check the encoder byte-for-byte against the original tool's test vectors, plus the schema,
the trigger-chord rules and the agent's text chunking. `MACROPAD_STATE` and `MACROPAD_PORT`
let you run a second instance against a scratch state directory.

## Credits

The keypad protocol was reverse-engineered by
[kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool) (MIT). The encoder in
`macropad.py` is a Python port of its `ch57x-1` (k884x) driver; see [`LICENSE`](LICENSE).

## License

[MIT](LICENSE)
