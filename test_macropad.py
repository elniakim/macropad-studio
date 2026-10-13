"""Byte-level tests ported from ch57x-keyboard-tool's k884x tests, plus mapping tests."""

import pytest

import macropad as mp


def strip(packets):
    return [p.rstrip(b"\0") for p in packets]


TAIL = [bytes([3, 0xAA, 0xAA]), bytes([3, 0xFD, 0xFE, 0xFF]), bytes([3, 0xAA, 0xAA])]


def bind(expr, key_id=1, layer=0):
    return strip(mp.encode_bind(key_id, layer, mp.parse_macro(expr)))


def test_packets_are_64_bytes():
    assert all(len(p) == 64 for p in mp.encode_bind(1, 0, mp.parse_macro("a")))


def test_keyboard():
    assert bind("ctrl-a") == [bytes([3, 0xFE, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 4])] + TAIL


def test_media():
    assert bind("volumeup", 2) == [bytes([3, 0xFE, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0xE9])] + TAIL


def test_custom_consumer():
    assert bind("consumer(0x1b6)")[0] == bytes([3, 0xFE, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0xB6, 0x01])


def test_mouse_click():
    assert bind("click", 3)[0] == bytes([3, 0xFE, 3, 1, 3, 0, 0, 0, 0, 0, 1, 0, 1])


def test_mouse_move():
    assert bind("move(10,-5)", 4)[0] == bytes([3, 0xFE, 4, 1, 3, 0, 0, 0, 0, 0, 5, 0, 0, 0x0A, 0xFB])


def test_mouse_wheel():
    assert bind("wheel(3)", 5)[0] == bytes([3, 0xFE, 5, 1, 3, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3])


def test_mouse_drag():
    assert bind("drag(left,5,10)", 6)[0] == bytes([3, 0xFE, 6, 1, 3, 0, 0, 0, 0, 0, 5, 0, 1, 5, 0x0A])


def test_delay():
    out = bind("{delay(1000)}ctrl-a")
    assert out[1] == bytes([3, 0xFE, 1, 1, 5, 0xE8, 0x03])
    assert len(out) == 5


def test_delay_limit():
    with pytest.raises(ValueError, match="6000"):
        bind("{delay(6001)}a")


def test_lone_modifier_has_zero_count():
    assert bind("alt-shift")[0] == bytes([3, 0xFE, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0x06])


def test_parse_accords():
    assert mp._parse_accord("cmd-shift-4") == (0x0A, mp.KEYS["4"])
    assert mp._parse_accord("shift-<100>") == (0x02, 100)
    with pytest.raises(mp.ParseError):
        mp._parse_accord("a1")


def test_knob_ids():
    lay = mp.Layout(12, 2)
    assert lay.button_id(0) == 1
    assert [lay.knob_id(0, a) for a in range(3)] == [16, 17, 18]
    assert lay.knob_id(1, 2) == 21
    assert mp.Layout(12, 4).knob_id(3, 1) == 14


def test_led():
    assert strip(mp.encode_led(0, mp.led_code("backlight", "cyan")))[0] == bytes(
        [3, 0xFE, 0xB0, 1, 8, 0, 0, 0, 0, 0, 1, 0, 0x51])
    assert mp.led_code("backlight", "white") == 0x05
    assert mp.led_code("press", "purple") == 0x74


def mapping(slots, **layer):
    return {"rows": 3, "columns": 4, "knobs": 2, "layers": [{"slots": slots, **layer}]}


def test_compile_hardware_and_software():
    c = mp.compile_mapping(mapping({
        "b0": {"type": "keys", "steps": ["cmd-c"], "label": "copy"},
        "b1": {"type": "text", "text": "안녕"},
        "k1.cw": {"type": "shell", "command": "true"},
        "k0.press": {"type": "mouse", "action": "click", "buttons": ["middle"]},
    }, led="press green"))
    assert (c.hardware_slots, c.software_slots) == (2, 2)
    # software slot b1 -> hyper + F16
    assert c.packets[4].rstrip(b"\0") == bytes([3, 0xFE, 2, 1, 1, 0, 0, 0, 0, 0, 1, 0x0F, mp.KEYS["f16"]])
    assert set(c.triggers) == {"15:f16", "15:f17"}
    assert c.triggers["15:f17"]["slot"] == "k1.cw"
    assert c.packets[-2].rstrip(b"\0")[-1] == 0x44


def test_compile_reports_slot():
    with pytest.raises(ValueError, match="layer 1 b3"):
        mp.compile_mapping(mapping({"b3": {"type": "keys", "steps": ["nope"]}}))


def test_trigger_capacity():
    assert mp.MAX_SOFTWARE_SLOTS == 40
    assert mp.trigger(39) == (0x0E, "f15")
    with pytest.raises(ValueError):
        mp.trigger(40)


def test_yaml_example_config():
    import yaml
    cfg = mp.load_config(yaml.safe_load("""
model: ch57x-1
orientation: normal
rows: 3
columns: 4
knobs: 2
layers:
  - buttons:
      - ["a", "ctrl-a", "alt-shift", "alt-ctrl,ctrl-b"]
      - ["click", "click(middle)", "click+rclick", "ctrl-mclick"]
      - ["play", "prev", "{delay(100)}h,i", "<100>"]
    knobs:
      - {ccw: wheelup, press: click, cw: wheeldown}
      - {ccw: volumedown, press: mute, cw: volumeup}
"""))
    assert len(mp.render_packets(cfg)) == 18 * 4 + 1


# --- regressions from the pre-release review ---------------------------------


def test_empty_slots_are_cleared_on_upload():
    # Every slot is written, so stale trigger chords can't survive on the keypad.
    c = mp.compile_mapping(mapping({"b1": {"type": "shell", "command": "true"}}))
    binds = [p for p in c.packets if p[1] == 0xFE and p[4] in (1, 2, 3)]
    assert len(binds) == 18
    assert binds[0].rstrip(b"\0") == bytes([3, 0xFE, 1, 1, 1])  # b0 -> empty keyboard macro


def test_trigger_numbering_cannot_leave_stale_binding():
    first = mp.compile_mapping(mapping({"b0": {"type": "shell", "command": "a"},
                                        "b1": {"type": "shell", "command": "b"}}))
    second = mp.compile_mapping(mapping({"b1": {"type": "shell", "command": "b"}}))
    assert first.triggers["15:f16"]["command"] == "a"
    assert second.triggers["15:f16"]["command"] == "b"
    b0 = [p for p in second.packets if p[:3] == bytes([3, 0xFE, 1])][0]
    assert b0.rstrip(b"\0") == bytes([3, 0xFE, 1, 1, 1])  # b0 no longer sends 15:f16


def test_mouse_move_never_sends_buttons():
    m = mp.hardware_macro({"type": "mouse", "action": "move", "buttons": ["left"], "dx": 5, "dy": 0})
    assert strip(mp.encode_bind(1, 0, m))[0] == bytes([3, 0xFE, 1, 1, 3, 0, 0, 0, 0, 0, 5, 0, 0, 5])


@pytest.mark.parametrize("step", ["ctrl-alt-shift-cmd-f16", "rctrl-ralt-rshift-rcmd-f16", "ctrl-alt-shift-f13"])
def test_hardware_keys_cannot_use_trigger_chords(step):
    with pytest.raises(ValueError, match="reserved"):
        mp.hardware_macro({"type": "keys", "steps": [step]})


def test_normalize_rejects_non_numeric_fields():
    bad = mapping({"b0": {"type": "keys", "steps": ["a"], "delay": '0" onfocus="alert(1)'}})
    with pytest.raises(ValueError, match="delay"):
        mp.normalize_mapping(bad)
    with pytest.raises(ValueError):
        mp.normalize_mapping({"rows": "3\" x", "columns": 4, "knobs": 2, "layers": [{}]})


@pytest.mark.parametrize("bad", [{}, "x", [], {"rows": 3, "columns": 4, "knobs": 2, "layers": [{"slots": {"b0": "x"}}]},
                                 {"rows": 3, "columns": 4, "knobs": 2, "layers": [{"slots": {"zz": {"type": "keys"}}}]}])
def test_normalize_rejects_malformed(bad):
    with pytest.raises(ValueError):
        mp.normalize_mapping(bad)


def test_normalize_drops_unknown_fields():
    m = mp.normalize_mapping(mapping({"b0": {"type": "text", "text": "hi", "evil": "<script>"}}))
    assert m["layers"][0]["slots"]["b0"] == {"type": "text", "text": "hi"}


def test_slot_errors_enforce_agent_limit():
    slots = {f"b{i}": {"type": "text", "text": "x"} for i in range(12)}
    slots.update({f"k{k}.{a}": {"type": "text", "text": "x"} for k in range(2) for a in ("ccw", "press", "cw")})
    m = mp.normalize_mapping({"rows": 3, "columns": 4, "knobs": 2, "layers": [{"slots": dict(slots)} for _ in range(3)]})
    errors = mp.slot_errors(m)
    assert len(errors) == 54 - 40


@pytest.mark.parametrize("value", ["printscreen", "f21", "<100>", "cmd"])
def test_macro_keys_must_be_sendable_from_macos(value):
    action = mp.normalize_action({"type": "macro", "steps": [{"do": "keys", "value": value}]})
    with pytest.raises(ValueError):
        mp.check_software(action)


def test_agent_text_chunks_fit_utf16_limit():
    agent = pytest.importorskip("agent")
    chunks = list(agent._utf16_chunks("안녕" * 3 + "😀" * 15))
    assert "".join(chunks) == "안녕" * 3 + "😀" * 15
    assert all(len(c.encode("utf-16-le")) // 2 <= 20 for c in chunks)
