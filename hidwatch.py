"""Watches what the keypad itself sends, so the editor can show each press and knob detent.

The keypad's input interface is opened in shared mode through IOKit (the keypad keeps working
normally) and only the supported keypads are matched; no other device is read. Media keys,
scroll, mouse buttons and, where macOS delivers them, keyboard usages are turned into small
events that server.py hands to the editor. Needs Input Monitoring permission for the app that
runs server.py; without it, or off macOS, the watcher simply doesn't start.
"""

from __future__ import annotations

import ctypes as C
import sys
import threading
import time

import macropad as mp

V = C.c_void_p
_KEEP = []  # keeps the callback and CF objects alive for the life of the process


class Watcher:
    def __init__(self, keep: int = 200):
        self.events: list[dict] = []
        self.seq = 0
        self.keep = keep
        self.mods = 0
        self.pending: list[int] = []  # key usages from the report being read
        self.stamp = None
        self.cond = threading.Condition()
        self.running = False

    # --- event log -----------------------------------------------------------
    def push(self, ev: dict):
        with self.cond:
            self.seq += 1
            self.events.append({"seq": self.seq, "at": time.time(), **ev})
            del self.events[:-self.keep]
            self.cond.notify_all()

    def since(self, after: int, timeout: float) -> tuple[int, list[dict]]:
        """Events newer than `after`, waiting up to `timeout` seconds for the first one."""
        with self.cond:
            if after > self.seq:  # the server restarted; start over
                after = 0
            self.cond.wait_for(lambda: self.seq > after, timeout)
            return self.seq, [e for e in self.events if e["seq"] > after]

    def on_value(self, page: int, usage: int, value: int, stamp: int = 0):
        # One report arrives as several values with the same timestamp, and a key can come before its
        # modifiers, so keys are only emitted once the whole report has been read.
        if stamp != self.stamp:
            self.flush()
            self.stamp = stamp
        if page == 0x0C and usage not in (0, 0xFFFFFFFF) and value:
            self.push({"kind": "media", "code": usage})
        elif page == 0x01 and usage == 0x38 and value:
            self.push({"kind": "wheel", "delta": 1 if value > 0 else -1})
        elif page == 0x01 and usage in (0x30, 0x31) and value:
            self.push({"kind": "move", "axis": "x" if usage == 0x30 else "y", "delta": value})
        elif page == 0x09 and 1 <= usage <= 3 and value:
            self.push({"kind": "button", "button": ("left", "right", "middle")[usage - 1]})
        elif page == 0x07 and 0xE0 <= usage <= 0xE7:
            bit = 1 << (usage - 0xE0)
            self.mods = self.mods | bit if value else self.mods & ~bit
        elif page == 0x07 and 4 <= usage < 0xE0 and value:
            self.pending.append(usage)

    def flush(self):
        for code in self.pending:
            self.push({"kind": "key", "mods": self.mods, "code": code})
        self.pending = []

    # --- IOKit ---------------------------------------------------------------
    def start(self) -> bool:
        if sys.platform != "darwin":
            return False
        try:
            iok, cf, manager = _open_manager(self.on_value)
        except OSError:
            return False

        def run():
            iok.IOHIDManagerScheduleWithRunLoop(manager, cf.CFRunLoopGetCurrent(), _mode(cf))
            if iok.IOHIDManagerOpen(manager, 0) == 0:  # kIOHIDOptionsTypeNone: shared, never seized
                self.running = True
                cf.CFRunLoopRun()

        threading.Thread(target=run, name="hidwatch", daemon=True).start()
        return True


def _mode(cf):
    return V.in_dll(cf, "kCFRunLoopDefaultMode")


def _open_manager(on_value):
    iok = C.CDLL("/System/Library/Frameworks/IOKit.framework/IOKit")
    cf = C.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
    for f, res, args in [
        (cf.CFDictionaryCreateMutable, V, [V, C.c_long, V, V]), (cf.CFDictionarySetValue, None, [V, V, V]),
        (cf.CFArrayCreateMutable, V, [V, C.c_long, V]), (cf.CFArrayAppendValue, None, [V, V]),
        (cf.CFNumberCreate, V, [V, C.c_int, V]), (cf.CFStringCreateWithCString, V, [V, C.c_char_p, C.c_uint32]),
        (cf.CFRunLoopGetCurrent, V, []), (cf.CFRunLoopRun, None, []),
        (iok.IOHIDManagerCreate, V, [V, C.c_uint32]), (iok.IOHIDManagerSetDeviceMatchingMultiple, None, [V, V]),
        (iok.IOHIDManagerOpen, C.c_int32, [V, C.c_uint32]),
        (iok.IOHIDManagerScheduleWithRunLoop, None, [V, V, V]),
        (iok.IOHIDManagerRegisterInputValueCallback, None, [V, V, V]),
        (iok.IOHIDValueGetElement, V, [V]), (iok.IOHIDValueGetIntegerValue, C.c_long, [V]),
        (iok.IOHIDValueGetTimeStamp, C.c_uint64, [V]),
        (iok.IOHIDElementGetUsagePage, C.c_uint32, [V]), (iok.IOHIDElementGetUsage, C.c_uint32, [V]),
    ]:
        f.restype, f.argtypes = res, args

    keys = C.addressof(C.c_char.in_dll(cf, "kCFTypeDictionaryKeyCallBacks"))
    vals = C.addressof(C.c_char.in_dll(cf, "kCFTypeDictionaryValueCallBacks"))
    arr_cb = C.addressof(C.c_char.in_dll(cf, "kCFTypeArrayCallBacks"))

    def cfstr(s):
        return cf.CFStringCreateWithCString(None, s.encode(), 0x08000100)  # UTF-8

    def cfnum(n):
        x = C.c_int32(n)
        return cf.CFNumberCreate(None, 3, C.byref(x))  # kCFNumberSInt32Type

    matching = cf.CFArrayCreateMutable(None, 0, arr_cb)
    for vid, pid in mp.SUPPORTED_IDS:
        d = cf.CFDictionaryCreateMutable(None, 0, keys, vals)
        cf.CFDictionarySetValue(d, cfstr("VendorID"), cfnum(vid))
        cf.CFDictionarySetValue(d, cfstr("ProductID"), cfnum(pid))
        cf.CFArrayAppendValue(matching, d)

    manager = iok.IOHIDManagerCreate(None, 0)
    iok.IOHIDManagerSetDeviceMatchingMultiple(manager, matching)

    @C.CFUNCTYPE(None, V, C.c_int32, V, V)
    def callback(ctx, result, sender, value):
        try:
            el = iok.IOHIDValueGetElement(value)
            on_value(iok.IOHIDElementGetUsagePage(el), iok.IOHIDElementGetUsage(el),
                     iok.IOHIDValueGetIntegerValue(value), iok.IOHIDValueGetTimeStamp(value))
        except Exception:  # never let an exception unwind into IOKit
            pass

    iok.IOHIDManagerRegisterInputValueCallback(manager, callback, None)
    _KEEP.extend([callback, matching, manager])
    return iok, cf, manager
