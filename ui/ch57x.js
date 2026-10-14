// CH57x "ch57x-1" protocol encoder for the browser (WebHID) and Node tests.
// A line-for-line port of the encoder in macropad.py; test_macropad.py checks that both
// produce identical bytes. Protocol originally reverse-engineered by
// kriomant/ch57x-keyboard-tool (MIT).
(function (root) {
  "use strict";

  const MODIFIERS = { ctrl: 0x01, shift: 0x02, alt: 0x04, opt: 0x04, win: 0x08, cmd: 0x08,
                      rctrl: 0x10, rshift: 0x20, ralt: 0x40, ropt: 0x40, rwin: 0x80, rcmd: 0x80 };
  const KEY_ORDER = [
    ..."abcdefghijklmnopqrstuvwxyz", ..."1234567890",
    "enter", "escape", "backspace", "tab", "space", "minus", "equal", "leftbracket", "rightbracket",
    "backslash", "nonushash", "semicolon", "quote", "grave", "comma", "dot", "slash", "capslock",
    ...Array.from({ length: 12 }, (_, i) => "f" + (i + 1)),
    "printscreen", "scrolllock", "pause", "insert", "home", "pageup", "delete", "end", "pagedown",
    "right", "left", "down", "up", "numlock", "numpadslash", "numpadasterisk", "numpadminus",
    "numpadplus", "numpadenter", ...[..."1234567890"].map(d => "numpad" + d),
    "numpaddot", "nonusbackslash", "application", "power", "numpadequal",
    ...Array.from({ length: 12 }, (_, i) => "f" + (i + 13)),
  ];
  const KEYS = Object.fromEntries(KEY_ORDER.map((k, i) => [k, 0x04 + i]));
  const KEY_ALIASES = { esc: "escape", macbrightnessdown: "scrolllock", macbrightnessup: "pause" };
  const MEDIA = {
    screenbrightnessup: 0x6f, screenbrightnessdown: 0x70, next: 0xb5, previous: 0xb6, prev: 0xb6,
    stop: 0xb7, play: 0xcd, mute: 0xe2, volumeup: 0xe9, volumedown: 0xea, favorites: 0x182,
    calculator: 0x192, screenlock: 0x19e, webpagehome: 0x223, webpageback: 0x224, webpageforward: 0x225,
  };
  const MOUSE_MODIFIERS = { ctrl: 0x01, shift: 0x02, alt: 0x04 };
  const MOUSE_BUTTONS = { left: 0x01, right: 0x02, middle: 0x04 };
  const CLICK_ALIASES = { click: "left", lclick: "left", rclick: "right", mclick: "middle" };
  const KNOB_ACTIONS = { ccw: 0, press: 1, cw: 2 };
  const LED_COLORS = { white: 0, red: 1, orange: 2, yellow: 3, green: 4, cyan: 5, blue: 6, purple: 7 };
  const LED_MODES = { off: 0, backlight: 1, shock: 2, shock2: 3, press: 4 };
  const HARDWARE_TYPES = new Set(["keys", "media", "mouse", "raw"]);
  const SOFTWARE_TYPES = new Set(["text", "open", "shell", "macro"]);
  const MACRO_STEPS = new Set(["keys", "text", "wait", "open", "shell"]);
  const TRIGGER_KEYS = ["f16", "f17", "f18", "f19", "f20", "f13", "f14", "f15"];
  const TRIGGER_MODS = [0x0f, 0x07, 0x0d, 0x0b, 0x0e];
  const MAX_SOFTWARE_SLOTS = TRIGGER_KEYS.length * TRIGGER_MODS.length;
  const TRIGGER_CODES = new Set(TRIGGER_KEYS.map(k => KEYS[k]));
  const PACKET = 64;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  class ParseError extends Error {}

  // --- parsing ---------------------------------------------------------------

  function delta(s) {
    const v = parseInt(s, 10);
    if (!(v >= -128 && v <= 127)) throw new ParseError(`value out of range -128..127: ${v}`);
    return v;
  }
  function buttons(s) {
    let bits = 0;
    for (const b of s.split("+")) {
      if (!has(MOUSE_BUTTONS, b)) throw new ParseError(`unknown mouse button: '${b}'`);
      bits |= MOUSE_BUTTONS[b];
    }
    return bits;
  }
  const NUM = "(-?\\d+)";
  function parseMouse(s) {
    let modifier = 0, m;
    if ((m = s.match(/^(ctrl|shift|alt)-(.+)$/))) { modifier = MOUSE_MODIFIERS[m[1]]; s = m[2]; }
    if ((m = s.match(new RegExp(`^move\\(${NUM},${NUM}\\)$`)))) return { kind: "mouse", action: "move", modifier, buttons: 0, dx: delta(m[1]), dy: delta(m[2]), delta: 0 };
    if ((m = s.match(new RegExp(`^drag\\(([a-z+]+),${NUM},${NUM}\\)$`)))) return { kind: "mouse", action: "drag", modifier, buttons: buttons(m[1]), dx: delta(m[2]), dy: delta(m[3]), delta: 0 };
    if ((m = s.match(new RegExp(`^wheel\\(${NUM}\\)$`)))) return { kind: "mouse", action: "wheel", modifier, buttons: 0, dx: 0, dy: 0, delta: delta(m[1]) };
    if (s === "wheelup" || s === "wheeldown") return { kind: "mouse", action: "wheel", modifier, buttons: 0, dx: 0, dy: 0, delta: s === "wheelup" ? 1 : -1 };
    if ((m = s.match(/^click\(([a-z+]+)\)$/))) return { kind: "mouse", action: "click", modifier, buttons: buttons(m[1]), dx: 0, dy: 0, delta: 0 };
    const parts = s.split("+");
    if (parts.every(p => has(CLICK_ALIASES, p)))
      return { kind: "mouse", action: "click", modifier, buttons: buttons(parts.map(p => CLICK_ALIASES[p]).join("+")), dx: 0, dy: 0, delta: 0 };
    return null;
  }
  function parseCode(s) {
    const m = s.match(/^<(\d+)>$/);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v > 255) throw new ParseError(`custom key code out of range: ${v}`);
      return v;
    }
    const name = has(KEY_ALIASES, s) ? KEY_ALIASES[s] : s;
    return has(KEYS, name) ? KEYS[name] : null;
  }
  function parseAccord(s) {
    const parts = s.split("-");
    let mods = 0;
    for (const p of parts.slice(0, -1)) {
      if (!has(MODIFIERS, p)) throw new ParseError(`unknown modifier '${p}' in '${s}'`);
      mods |= MODIFIERS[p];
    }
    const last = parts[parts.length - 1];
    const code = parseCode(last);
    if (code !== null) return [mods, code];
    if (has(MODIFIERS, last)) return [mods | MODIFIERS[last], 0];
    throw new ParseError(`unknown key '${last}' in '${s}'`);
  }
  function parseMacro(text) {
    let s = String(text).trim().toLowerCase();
    if (!s) throw new ParseError("empty macro");
    const mouse = parseMouse(s);
    if (mouse) return mouse;
    if (has(MEDIA, s)) return { kind: "media", code: MEDIA[s] };
    let m = s.match(/^consumer\((0x[0-9a-f]+|\d+)\)$/);
    if (m) {
      const code = Number(m[1]);
      if (!(code > 0 && code <= 0xffff)) throw new ParseError(`consumer code out of range: ${code}`);
      return { kind: "media", code };
    }
    let delay = 0;
    if ((m = s.match(/^\{([^}]*)\}(.+)$/))) {
      for (const opt of m[1].split(",").filter(Boolean)) {
        const d = opt.match(/^delay\((\d+)\)$/);
        if (!d) throw new ParseError(`unknown option '${opt}'`);
        delay = parseInt(d[1], 10);
      }
      s = m[2];
    }
    return { kind: "keys", accords: s.split(",").map(parseAccord), delay };
  }

  // --- encoding --------------------------------------------------------------

  function packet(...bytes) {
    const p = new Uint8Array(PACKET);
    p.set(bytes.map(b => b & 0xff));
    return p;
  }
  class Layout {
    constructor(nButtons = 12, knobs = 2) {
      if (!((nButtons <= 15 && knobs <= 3) || (nButtons <= 12 && knobs <= 4)))
        throw new Error("unsupported combination of buttons and knobs count");
      this.buttons = nButtons; this.knobs = knobs;
    }
    buttonId(n) {
      if (n >= 15 || (n >= 12 && this.knobs === 4)) throw new Error(`invalid button index ${n}`);
      return n + 1;
    }
    knobId(n, action) {
      if (n === 3 && this.buttons <= 12) return 13 + action;
      if (n >= 3) throw new Error(`invalid knob index ${n}`);
      return 16 + 3 * n + action;
    }
  }
  function encodeBind(keyId, layer, macro) {
    if (!(layer >= 0 && layer <= 15)) throw new Error("invalid layer index");
    const head = [0x03, 0xfe, keyId, layer + 1];
    let body;
    if (macro.kind === "keys") {
      if (macro.accords.length > 18) throw new Error("macro sequence is too long");
      const count = macro.accords.length === 1 && macro.accords[0][1] === 0 ? 0 : macro.accords.length;
      body = [1, 0, 0, 0, 0, 0, count];
      for (const [mods, code] of macro.accords) body.push(mods, code);
    } else if (macro.kind === "media") {
      body = [2, 0, 0, 0, 0, 0, 0, macro.code & 0xff, macro.code >> 8];
    } else {
      const prefix = [3, 0, 0, 0, 0, 0];
      if (macro.action === "click") {
        if (!macro.buttons) throw new Error("buttons must be given for click macro");
        body = [...prefix, 0x01, macro.modifier, macro.buttons];
      } else if (macro.action === "move" || macro.action === "drag") {
        body = [...prefix, 0x05, macro.modifier, macro.buttons, macro.dx, macro.dy];
      } else {
        body = [...prefix, 0x03, macro.modifier, 0, 0, 0, macro.delta];
      }
    }
    const packets = [packet(...head, ...body)];
    if (macro.kind === "keys" && macro.delay) {
      if (macro.delay > 6000) throw new Error("maximum supported delay is 6000ms");
      packets.push(packet(...head, 5, macro.delay & 0xff, macro.delay >> 8));
    }
    packets.push(packet(0x03, 0xaa, 0xaa), packet(0x03, 0xfd, 0xfe, 0xff), packet(0x03, 0xaa, 0xaa));
    return packets;
  }
  function ledCode(mode, color) {
    if (mode === "off") return 0;
    if (!has(LED_MODES, mode)) throw new Error(`unknown LED mode '${mode}'; use one of ${Object.keys(LED_MODES).join(", ")}`);
    if (!has(LED_COLORS, color ?? "")) throw new Error(`unknown LED color '${color}'; use one of ${Object.keys(LED_COLORS).join(", ")}`);
    if (color === "white") {
      if (mode !== "backlight") throw new Error("white is only available for backlight mode");
      return 0x05;
    }
    return (LED_COLORS[color] << 4) | LED_MODES[mode];
  }
  function encodeLed(layer, code) {
    if (!(layer >= 0 && layer <= 2)) throw new Error("layer must be 0-2");
    return [packet(0x03, 0xfe, 0xb0, layer + 1, 0x08, 0, 0, 0, 0, 0, 0x01, 0, code), packet(0x03, 0xfd, 0xfe, 0xff)];
  }

  // --- mapping schema --------------------------------------------------------

  function int(v, lo, hi, what) {
    let n;
    if (typeof v === "number") n = Math.trunc(v);
    else if (typeof v === "string" && /^\s*[+-]?\d+\s*$/.test(v)) n = parseInt(v, 10);
    else throw new Error(`${what} must be a number`);
    if (!(n >= lo && n <= hi)) throw new Error(`${what} must be between ${lo} and ${hi}`);
    return n;
  }
  function str(v, what, limit = 10000) {
    if (v === null || v === undefined) return "";
    if (typeof v !== "string") throw new Error(`${what} must be text`);
    if (v.length > limit) throw new Error(`${what} is too long`);
    return v;
  }
  function slotNames(rows, columns, knobs) {
    const names = Array.from({ length: rows * columns }, (_, i) => "b" + i);
    for (let k = 0; k < knobs; k++) for (const a of Object.keys(KNOB_ACTIONS)) names.push(`k${k}.${a}`);
    return names;
  }
  function normalizeAction(a) {
    if (!a || typeof a !== "object" || Array.isArray(a)) throw new Error("action must be an object");
    const t = a.type;
    if (!HARDWARE_TYPES.has(t) && !SOFTWARE_TYPES.has(t)) throw new Error(`unknown action type '${t}'`);
    const out = { type: t };
    if (a.label) out.label = str(a.label, "label", 60);
    if (t === "keys") {
      const steps = a.steps || [];
      if (!Array.isArray(steps) || steps.length > 18) throw new Error("steps must be a list of at most 18 keys");
      out.steps = steps.map(s => str(s, "key", 60));
      out.delay = int(a.delay || 0, 0, 6000, "delay");
    } else if (t === "media") {
      out.code = typeof a.code === "number" ? int(a.code, 1, 0xffff, "media code") : str(a.code, "media code", 20);
    } else if (t === "mouse") {
      if (!["click", "move", "drag", "wheel"].includes(a.action)) throw new Error(`unknown mouse action '${a.action}'`);
      const b = a.buttons || [];
      if (!Array.isArray(b) || b.some(x => !has(MOUSE_BUTTONS, x))) throw new Error("mouse buttons must be left/right/middle");
      const mod = a.modifier || "";
      if (mod && !has(MOUSE_MODIFIERS, mod)) throw new Error("mouse modifier must be ctrl, shift or alt");
      Object.assign(out, { action: a.action, buttons: [...new Set(b)], modifier: mod,
        dx: int(a.dx || 0, -128, 127, "dx"), dy: int(a.dy || 0, -128, 127, "dy"), delta: int(a.delta || 0, -128, 127, "scroll amount") });
    } else if (t === "raw") out.expr = str(a.expr, "expression", 500);
    else if (t === "text") out.text = str(a.text, "text");
    else if (t === "open") out.target = str(a.target, "target", 2000);
    else if (t === "shell") out.command = str(a.command, "command");
    else if (t === "macro") {
      const steps = a.steps || [];
      if (!Array.isArray(steps) || steps.length > 500) throw new Error("macro steps must be a list");
      out.steps = steps.map(st => {
        if (!st || typeof st !== "object" || !MACRO_STEPS.has(st.do)) throw new Error("unknown macro step");
        return st.do === "wait" ? { do: "wait", ms: int(st.ms || 0, 0, 600000, "wait") }
          : { do: st.do, value: str(st.value, "step"), repeat: int(st.repeat || 1, 1, 999, "repeat") };
      });
    }
    return out;
  }
  function normalizeMapping(m) {
    if (!m || typeof m !== "object" || Array.isArray(m)) throw new Error("mapping must be an object");
    const rows = int(m.rows, 1, 15, "rows"), columns = int(m.columns, 1, 15, "columns"), knobs = int(m.knobs, 0, 4, "knobs");
    new Layout(rows * columns, knobs);
    if (!Array.isArray(m.layers) || m.layers.length < 1 || m.layers.length > 3) throw new Error("the keypad has 1-3 layers");
    const names = new Set(slotNames(rows, columns, knobs));
    const layers = m.layers.map(layer => {
      if (!layer || typeof layer !== "object" || Array.isArray(layer)) throw new Error("layer must be an object");
      const out = { slots: {} };
      if (layer.name) out.name = str(layer.name, "layer name", 60);
      if (layer.led) {
        const led = str(layer.led, "LED mode", 30);
        const w = led.split(/\s+/).filter(Boolean);
        ledCode(w[0], w[1]);
        out.led = led;
      }
      const slots = layer.slots || {};
      if (typeof slots !== "object" || Array.isArray(slots)) throw new Error("slots must be an object");
      for (const [name, action] of Object.entries(slots)) {
        if (!names.has(name)) throw new Error(`unknown slot '${name}'`);
        if (action !== null && action !== undefined) out.slots[name] = normalizeAction(action);
      }
      return out;
    });
    return { rows, columns, knobs, layers };
  }

  // --- per-action checks and compilation ------------------------------------

  function checkNotTrigger(macro) {
    if (macro.kind !== "keys") return;
    for (const [mods, code] of macro.accords)
      if (TRIGGER_MODS.includes((mods | (mods >> 4)) & 0x0f) && TRIGGER_CODES.has(code))
        throw new Error("this shortcut is reserved for agent triggers");
  }
  function hardwareMacro(action) {
    const t = action.type;
    let macro;
    if (t === "keys") {
      const steps = (action.steps || []).map(s => s.trim().toLowerCase()).filter(Boolean);
      if (!steps.length) throw new ParseError("add at least one key");
      macro = { kind: "keys", accords: steps.map(parseAccord), delay: parseInt(action.delay || 0, 10) };
    } else if (t === "media") {
      if (typeof action.code === "number") macro = { kind: "media", code: action.code };
      else {
        macro = parseMacro(has(MEDIA, action.code) ? action.code : `consumer(${action.code})`);
        if (macro.kind !== "media") throw new ParseError("not a media code");
      }
    } else if (t === "mouse") {
      const a = action.action;
      let bits = 0;
      if (a === "click" || a === "drag") for (const b of action.buttons || []) bits |= MOUSE_BUTTONS[b];
      if (a === "click" && !bits) throw new ParseError("pick at least one mouse button");
      macro = { kind: "mouse", action: a, modifier: MOUSE_MODIFIERS[action.modifier || ""] || 0, buttons: bits,
                dx: delta(String(action.dx ?? 0)), dy: delta(String(action.dy ?? 0)), delta: delta(String(action.delta ?? 0)) };
    } else if (t === "raw") macro = parseMacro(action.expr);
    else throw new ParseError(`unknown action type '${t}'`);
    checkNotTrigger(macro);
    return macro;
  }
  const NOOP = { kind: "keys", accords: [[0, 0]], delay: 0 };
  const AGENT_ONLY = "needs the Mac agent (local version of Macropad Studio)";

  function slotErrors(mapping, { agent = false } = {}) {
    const errors = {};
    const names = slotNames(mapping.rows, mapping.columns, mapping.knobs);
    let sw = 0;
    mapping.layers.forEach((layer, li) => {
      for (const name of names) {
        const action = layer.slots[name];
        if (!action) continue;
        try {
          if (SOFTWARE_TYPES.has(action.type)) {
            if (!agent) throw new Error(AGENT_ONLY);
            if (++sw > MAX_SOFTWARE_SLOTS) throw new Error(`too many agent actions (max ${MAX_SOFTWARE_SLOTS})`);
          } else encodeBind(1, li, hardwareMacro(action));
        } catch (e) { errors[`${li}:${name}`] = e.message; }
      }
    });
    return errors;
  }
  // Hardware-only compile (the browser has no agent). Every slot is written.
  function compileMapping(input) {
    const mapping = normalizeMapping(input);
    const layout = new Layout(mapping.rows * mapping.columns, mapping.knobs);
    const names = slotNames(mapping.rows, mapping.columns, mapping.knobs);
    const packets = [];
    let hardware = 0;
    mapping.layers.forEach((layer, li) => {
      for (const name of names) {
        const action = layer.slots[name];
        const keyId = name[0] === "b" ? layout.buttonId(+name.slice(1))
          : layout.knobId(+name.slice(1).split(".")[0], KNOB_ACTIONS[name.split(".")[1]]);
        try {
          let macro = NOOP;
          if (action) {
            if (SOFTWARE_TYPES.has(action.type)) throw new Error(AGENT_ONLY);
            macro = hardwareMacro(action);
            hardware++;
          }
          packets.push(...encodeBind(keyId, li, macro));
        } catch (e) { throw new Error(`layer ${li + 1} ${name}: ${e.message}`); }
      }
      if (layer.led) {
        const w = layer.led.split(/\s+/).filter(Boolean);
        packets.push(...encodeLed(li, ledCode(w[0], w[1])));
      }
    });
    return { packets, hardware, software: 0 };
  }

  const api = {
    KEYS, MEDIA, MODIFIERS, LED_COLORS, LED_MODES, KNOB_ACTIONS, HARDWARE_TYPES, SOFTWARE_TYPES,
    MAX_SOFTWARE_SLOTS, SUPPORTED_IDS: [[0x1189, 0x8840], [0x1189, 0x8842], [0x1189, 0x8850], [0x514c, 0x8851]],
    ParseError, Layout, parseAccord, parseMacro, encodeBind, ledCode, encodeLed, hardwareMacro,
    normalizeAction, normalizeMapping, slotNames, slotErrors, compileMapping,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CH57X = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
