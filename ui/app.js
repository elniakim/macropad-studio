"use strict";
// Refuse to run inside a frame (GitHub Pages can't send frame-ancestors; server.py also sends it).
if (window.top !== window.self) { document.documentElement.innerHTML = ""; throw new Error("framed"); }
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/* ---------- i18n ---------- */
const LANG_KEY = "macropad-studio/lang";
const LANG = (() => {
  try { const v = localStorage.getItem(LANG_KEY); if (v === "en" || v === "ko") return v; } catch {}
  return (navigator.language || "en").toLowerCase().startsWith("ko") ? "ko" : "en";
})();
document.documentElement.lang = LANG;
const STR = {
  en: {
    "gate.title": "Open Macropad Studio from its link",
    "gate.body": "For safety the UI only works with the private link that server.py prints and opens when it starts. Start it again (or copy the link from its output):",
    "agent.name": "Mac agent",
    "menu.export": "Export mapping…", "menu.import": "Import mapping…", "menu.github": "Source code & Mac app",
    "imp.risky": "This mapping runs commands on your Mac when its keys are pressed. Only import it if you trust where it came from:",
    "imp.ok": "Mapping imported", "imp.okSub": "Review it, then upload.", "imp.fail": "Couldn't import",
    "web.connect": "Connect keypad", "web.unsupported": "This browser can't talk to USB devices. Open this page in Chrome, Edge or another Chromium-based browser to upload to your keypad.",
    "web.noDevice": "No keypad selected", "web.agentOnly": "These need the Mac agent, which only ships with the local Mac app. Get it from GitHub (menu ··· → Source code & Mac app).",
    "web.picked": "Keypad connected", "web.pickedSub": "Press Upload to keypad to write your mapping.",
    "agent.tip": "Runs actions the keypad hardware can't do (typing text, opening apps, shell commands, macros) on this Mac",
    "menu.help": "What the keypad can do…", "menu.packets": "Show USB packets…", "menu.packetsTitle": "USB packets to be sent",
    "done": "Done",
    "hit.hint": "Press a keypad key to check it", "hit.pressed": "Pressed: {where}",
    "dev.on": "Keypad connected", "dev.off": "Keypad not connected", "dev.checking": "Looking for keypad",
    "up.errors": "{n} errors", "up.dirty": "Upload to keypad", "up.synced": "Uploaded", "up.busy": "Uploading…",
    "up.tipErr": "Fix the slots marked in red first", "up.tipDirty": "Write your changes to the keypad", "up.tipSynced": "The keypad matches this mapping. Click to upload again",
    "up.ok": "Uploaded", "up.okSub": "{hw} on the keypad, {sw} via the Mac agent",
    "up.fail": "Couldn't upload", "up.agentOff": "The Mac agent is off", "up.agentOffSub": "Turn it on in the toolbar so agent slots work.",
    "layer": "Layer {n}", "name": "Name", "led": "LED", "color": "Colour",
    "led.off": "Off", "led.backlight": "Always", "led.press": "On press", "led.shock": "Ripple", "led.shock2": "Ripple 2",
    "led.footer": "How the LEDs light up after you switch to this layer with the side button. White is only available for Always.",
    "usage": "Usage", "usage.of": "of {n} slots", "usage.dev": "Stored on the keypad", "usage.agt": "Mac agent",
    "slot.button": "Button {n}", "slot.knob": "Knob {n} {a}", "knob.ccw": "turn left", "knob.press": "press", "knob.cw": "turn right",
    "knob.pressShort": "Press", "empty": "Empty",
    "copy": "Copy", "paste": "Paste", "clear": "Clear", "copied": "Copied", "copiedSub": "Pick another slot and press Paste.",
    "change": "Change…", "cancel": "Cancel", "keycap": "Keycap label",
    "kind.dev": "Stored on the keypad", "kind.agt": "Run by the Mac agent",
    "note.dev": "Uploading stores this in the keypad's memory. It works even when this Mac is off, or on another computer.",
    "note.agt": "The keypad stores a hidden shortcut and the agent on this Mac performs the action.",
    "note.agtOff": "The agent is off, so pressing this key does nothing right now.",
    "pick.dev": "Stored on the keypad", "pick.devSub": "works without a computer",
    "pick.agt": "Mac agent", "pick.agtSub": "this Mac only, no limits",
    "pick.agtFooter": "Things the hardware can't do. Turn on the Mac agent in the toolbar for these to work.",
    "type.keys": "Keystrokes", "type.keys.d": "A shortcut or key sequence, up to 18 steps",
    "type.media": "Media", "type.media.d": "Volume, playback, brightness and other media keys",
    "type.mouse": "Mouse", "type.mouse.d": "Click, scroll, move the pointer, drag",
    "type.raw": "Expression", "type.raw.d": "Write it in the original tool's syntax",
    "type.text": "Text", "type.text.d": "Type any text, including emoji and non-Latin scripts",
    "type.open": "Open", "type.open.d": "Apps, websites, files and folders",
    "type.shell": "Shell command", "type.shell.d": "Terminal commands, AppleScript, Shortcuts",
    "type.macro": "Macro", "type.macro.d": "Several actions in order, with waits and repeats",
    "keys.title": "Keys to press", "keys.rec": "Record", "keys.recStop": "Stop", "keys.recHint": "Turn on and press keys on your keyboard",
    "keys.ph": "e.g. cmd-shift-4, then return", "keys.footer": "Shortcuts the system grabs first, like ⌘Tab, can be typed instead: <code>cmd-tab</code>.",
    "keys.delay": "Delay between steps", "keys.delayFooter": "The hardware uses one delay between all steps. Use a macro for different waits.",
    "keys.cant": "This key can't be recorded",
    "media.title": "Media key", "media.custom": "Custom code", "media.footer": "Any USB HID Consumer usage code. Whether macOS reacts depends on the code.",
    "mouse.title": "Mouse", "mouse.action": "Action", "mouse.click": "Click", "mouse.wheel": "Scroll", "mouse.move": "Move", "mouse.drag": "Drag",
    "mouse.buttons": "Buttons", "mouse.left": "Left", "mouse.middle": "Middle", "mouse.right": "Right",
    "mouse.amount": "Scroll amount", "mouse.amountSub": "+ up · − down", "mouse.mod": "Modifier", "mouse.none": "None",
    "mouse.footer": "You can combine buttons. One modifier at most; the hardware has no ⌘ for mouse actions.",
    "raw.title": "Expression", "raw.footer": "The original ch57x-keyboard-tool syntax.",
    "text.title": "Text to type", "text.ph": "Thanks! I'll get back to you shortly.",
    "text.footer": "Any text works, including emoji and Korean. Line breaks are typed as return, regardless of the input source.",
    "open.title": "What to open", "open.ph": "Safari, https://…, ~/Downloads",
    "open.footer": "Pick an app from the list. URLs open in your default browser, paths in Finder or their app.",
    "shell.title": "Command", "shell.footer": "Runs in the background with <code>zsh -lc</code>; output is discarded. <code>osascript</code> and <code>shortcuts run</code> work too.",
    "macro.title": "Steps", "macro.footer": "No limit on steps. Shell steps finish before the next step starts.", "macro.first": "Add the first step below",
    "macro.keysPh": "cmd-c (separate several with commas)", "macro.textPh": "Text to type", "macro.shellPh": "Command",
    "macro.repeat": "Repeat", "macro.times": "times", "macro.up": "Move up", "macro.down": "Move down", "macro.del": "Delete",
    "step.keys": "Keystrokes", "step.text": "Text", "step.wait": "Wait", "step.open": "Open", "step.shell": "Shell command",
    "test": "Run test", "test.hint": "Click the window where you want to see the result within 1.5 seconds.",
    "test.toast": "Running in 1.5 seconds", "test.toastSub": "Click the window where you want to see the result.", "test.fail": "Couldn't run it",
    "agent.on": "Mac agent is on", "agent.onSub": "Text, open, shell and macro slots now work.",
    "agent.off": "Mac agent is off", "agent.offSub": "Agent slots do nothing until you turn it back on.", "agent.fail": "Couldn't change the agent",
    "save.fail": "Couldn't save", "preview.fail": "Can't preview",
    "help.title": "What the keypad can do",
    "help.rows": [
      ["Layers", "3, switched with the side button. Each layer has its own LED mode."],
      ["Slots", "12 buttons + 2 knobs × (left, press, right) = 18 per layer, 54 in total."],
      ["@dev Keystrokes", "Up to 18 steps of modifiers + one key. One delay (0–6000 ms) applies between all steps. Two regular keys can't be held together."],
      ["@dev Media", "One media key. You can enter a raw HID Consumer code. Can't be mixed with keystrokes."],
      ["@dev Mouse", "Click (any button combination), scroll ±127, move or drag ±127 px. One modifier at most: control, shift or option."],
      ["Not possible in hardware", "Typing text, different waits per step, repeats, hold vs tap, launching apps."],
      ["@agt Mac agent", "A small background program on this Mac. The keypad stores a hidden shortcut (e.g. ⌃⌥⇧⌘F16); the agent catches it and types text, opens apps or URLs, runs shell commands or macros. Agent slots do nothing while it's off. Up to 40."],
    ],
    "auto.keys": "Keystrokes", "auto.click": "{b} click", "auto.drag": "{b} drag", "auto.scroll": "Scroll {d}", "auto.up": "up", "auto.down": "down",
    "auto.move": "Pointer {x},{y}", "auto.macro": "Macro, {n} steps", "auto.media": "Media {c}",
    "btn.left": "Left", "btn.right": "Right", "btn.middle": "Middle",
    "media.play": "Play/Pause", "media.previous": "Previous", "media.next": "Next", "media.stop": "Stop",
    "media.volumedown": "Volume down", "media.mute": "Mute", "media.volumeup": "Volume up",
    "media.screenbrightnessdown": "Brightness down", "media.screenbrightnessup": "Brightness up",
    "media.calculator": "Calculator", "media.screenlock": "Lock screen", "media.favorites": "Favorites",
    "media.webpagehome": "Web home", "media.webpageback": "Web back", "media.webpageforward": "Web forward",
  },
  ko: {
    "gate.title": "링크로 Macropad Studio를 열어 주세요",
    "gate.body": "보안을 위해 server.py가 시작할 때 출력하고 여는 전용 링크로만 동작해요. 다시 실행하거나 출력된 링크를 복사해 여세요:",
    "agent.name": "맥 에이전트",
    "menu.export": "매핑 내보내기…", "menu.import": "매핑 가져오기…", "menu.github": "소스 코드 · 맥 앱",
    "imp.risky": "이 매핑은 키를 누르면 이 맥에서 명령을 실행해요. 믿을 수 있는 출처일 때만 가져오세요:",
    "imp.ok": "매핑을 가져왔어요", "imp.okSub": "확인한 뒤 업로드하세요.", "imp.fail": "가져오지 못했어요",
    "web.connect": "키패드 연결", "web.unsupported": "이 브라우저는 USB 장치에 접근할 수 없어요. 키패드에 업로드하려면 Chrome, Edge 같은 크로미움 계열 브라우저로 여세요.",
    "web.noDevice": "선택한 키패드가 없어요", "web.agentOnly": "이 기능들은 맥 에이전트가 필요해서 로컬 맥 앱에서만 쓸 수 있어요. GitHub에서 받을 수 있어요 (메뉴 ··· → 소스 코드 · 맥 앱).",
    "web.picked": "키패드를 연결했어요", "web.pickedSub": "키패드에 업로드를 누르면 매핑이 기록돼요.",
    "agent.tip": "텍스트 입력·앱 열기·쉘·매크로처럼 키패드 하드웨어로는 못 하는 동작을 이 맥에서 대신 실행하는 백그라운드 프로그램이에요",
    "menu.help": "키패드로 할 수 있는 것…", "menu.packets": "전송될 패킷 보기…", "menu.packetsTitle": "전송될 USB 패킷",
    "done": "완료",
    "hit.hint": "키패드 키를 눌러 확인해 보세요", "hit.pressed": "눌림: {where}",
    "dev.on": "키패드 연결됨", "dev.off": "키패드 연결 안 됨", "dev.checking": "키패드 확인 중",
    "up.errors": "오류 {n}개", "up.dirty": "키패드에 업로드", "up.synced": "업로드됨", "up.busy": "업로드 중…",
    "up.tipErr": "빨간색으로 표시된 칸을 먼저 고쳐주세요", "up.tipDirty": "바뀐 내용을 키패드에 씁니다", "up.tipSynced": "키패드와 같은 상태예요. 눌러서 다시 올릴 수도 있어요",
    "up.ok": "업로드 완료", "up.okSub": "키패드 {hw}칸, 맥 에이전트 {sw}칸",
    "up.fail": "업로드하지 못했어요", "up.agentOff": "맥 에이전트가 꺼져 있어요", "up.agentOffSub": "에이전트 칸이 동작하려면 툴바에서 켜 주세요.",
    "layer": "레이어 {n}", "name": "이름", "led": "LED", "color": "색상",
    "led.off": "끔", "led.backlight": "항상", "led.press": "누를 때", "led.shock": "물결", "led.shock2": "물결 2",
    "led.footer": "옆면 버튼으로 이 레이어로 바꾸면 LED가 이렇게 켜져요. 흰색은 '항상' 모드에서만 쓸 수 있어요.",
    "usage": "사용량", "usage.of": "/ {n}칸", "usage.dev": "키패드에 저장", "usage.agt": "맥 에이전트",
    "slot.button": "버튼 {n}", "slot.knob": "노브 {n} {a}", "knob.ccw": "왼쪽으로", "knob.press": "누르기", "knob.cw": "오른쪽으로",
    "knob.pressShort": "누르기", "empty": "없음",
    "copy": "복사", "paste": "붙여넣기", "clear": "지우기", "copied": "복사했어요", "copiedSub": "다른 칸을 고른 뒤 붙여넣기를 누르세요.",
    "change": "변경…", "cancel": "취소", "keycap": "키캡 이름",
    "kind.dev": "키패드에 저장", "kind.agt": "맥 에이전트가 실행",
    "note.dev": "업로드하면 키패드 메모리에 저장돼요. 이 맥이 꺼져 있거나 다른 컴퓨터에 꽂아도 동작해요.",
    "note.agt": "키패드에는 숨은 단축키만 저장되고, 이 맥의 에이전트가 실제 동작을 실행해요.",
    "note.agtOff": "지금은 에이전트가 꺼져 있어서 이 키를 눌러도 아무 일도 일어나지 않아요.",
    "pick.dev": "키패드에 저장", "pick.devSub": "컴퓨터 없이도 동작",
    "pick.agt": "맥 에이전트", "pick.agtSub": "이 맥에서만, 제한 없음",
    "pick.agtFooter": "하드웨어로는 할 수 없는 동작이에요. 툴바에서 맥 에이전트를 켜 두어야 동작해요.",
    "type.keys": "키 입력", "type.keys.d": "단축키나 키 시퀀스, 최대 18단계",
    "type.media": "미디어", "type.media.d": "볼륨, 재생, 밝기 같은 미디어 키",
    "type.mouse": "마우스", "type.mouse.d": "클릭, 스크롤, 포인터 이동, 드래그",
    "type.raw": "고급 식", "type.raw.d": "원본 도구 문법으로 직접 입력",
    "type.text": "텍스트", "type.text.d": "한글·이모지가 들어간 문장을 그대로 입력",
    "type.open": "열기", "type.open.d": "앱, 웹사이트, 파일, 폴더",
    "type.shell": "쉘 명령", "type.shell.d": "터미널 명령, AppleScript, 단축어",
    "type.macro": "매크로", "type.macro.d": "여러 동작을 대기·반복과 함께 순서대로",
    "keys.title": "누를 키", "keys.rec": "녹화", "keys.recStop": "녹화 중지", "keys.recHint": "켜고 키보드로 누르면 그대로 입력돼요",
    "keys.ph": "예: cmd-shift-4 (return으로 추가)", "keys.footer": "⌘Tab처럼 시스템이 먼저 가져가는 조합은 <code>cmd-tab</code>처럼 직접 입력하세요.",
    "keys.delay": "단계 사이 딜레이", "keys.delayFooter": "하드웨어 제약으로 모든 단계 사이에 같은 딜레이가 들어가요. 단계마다 다르게 하려면 매크로를 쓰세요.",
    "keys.cant": "녹화할 수 없는 키예요",
    "media.title": "미디어 키", "media.custom": "직접 지정", "media.footer": "USB HID Consumer 페이지 코드를 넣어요. macOS가 반응하는지는 코드마다 달라요.",
    "mouse.title": "마우스", "mouse.action": "동작", "mouse.click": "클릭", "mouse.wheel": "스크롤", "mouse.move": "이동", "mouse.drag": "드래그",
    "mouse.buttons": "버튼", "mouse.left": "왼쪽", "mouse.middle": "가운데", "mouse.right": "오른쪽",
    "mouse.amount": "스크롤 양", "mouse.amountSub": "+ 위로 · − 아래로", "mouse.mod": "수정키", "mouse.none": "없음",
    "mouse.footer": "버튼은 여러 개를 함께 고를 수 있어요. 수정키는 하나만, ⌘는 하드웨어가 지원하지 않아요.",
    "raw.title": "식", "raw.footer": "원본 ch57x-keyboard-tool 문법이에요.",
    "text.title": "입력할 텍스트", "text.ph": "안녕하세요. 확인 후 회신 드리겠습니다.",
    "text.footer": "한글과 이모지 모두 돼요. 줄바꿈은 return으로 들어가고, 입력 소스(한/영)와 상관없이 그대로 입력돼요.",
    "open.title": "열 대상", "open.ph": "Safari, https://…, ~/Downloads",
    "open.footer": "앱 이름은 목록에서 고를 수 있어요. URL은 기본 브라우저로, 경로는 Finder나 연결된 앱으로 열려요.",
    "shell.title": "명령", "shell.footer": "<code>zsh -lc</code>로 백그라운드에서 실행되고 출력은 버려져요. <code>osascript</code>나 <code>shortcuts run</code>도 쓸 수 있어요.",
    "macro.title": "단계", "macro.footer": "단계 수 제한은 없어요. 쉘 명령은 끝날 때까지 기다린 뒤 다음 단계로 넘어가요.", "macro.first": "아래에서 첫 단계를 추가하세요",
    "macro.keysPh": "cmd-c (여러 개는 쉼표로)", "macro.textPh": "입력할 텍스트", "macro.shellPh": "명령",
    "macro.repeat": "반복", "macro.times": "번", "macro.up": "위로 이동", "macro.down": "아래로 이동", "macro.del": "삭제",
    "step.keys": "키 입력", "step.text": "텍스트", "step.wait": "대기", "step.open": "열기", "step.shell": "쉘 명령",
    "test": "테스트 실행", "test.hint": "누르고 1.5초 안에 결과를 볼 창을 클릭해 두세요.",
    "test.toast": "1.5초 뒤에 실행돼요", "test.toastSub": "결과를 볼 창을 클릭해 두세요.", "test.fail": "실행하지 못했어요",
    "agent.on": "맥 에이전트를 켰어요", "agent.onSub": "텍스트·열기·쉘·매크로 칸이 이제 동작해요.",
    "agent.off": "맥 에이전트를 껐어요", "agent.offSub": "에이전트 칸은 다시 켤 때까지 동작하지 않아요.", "agent.fail": "에이전트를 바꾸지 못했어요",
    "save.fail": "저장하지 못했어요", "preview.fail": "미리볼 수 없어요",
    "help.title": "키패드로 할 수 있는 것",
    "help.rows": [
      ["레이어", "3개. 옆면 버튼으로 바꾸고, 레이어마다 LED 모드를 따로 정할 수 있어요."],
      ["칸 수", "레이어당 버튼 12 + 노브 2 × (왼쪽·누름·오른쪽) = 18칸, 전체 54칸"],
      ["@dev 키 입력", "수정키 + 키 1개를 한 단계로, 최대 18단계. 단계 사이 딜레이는 0–6000ms 하나가 모든 단계에 똑같이 들어가요. 일반 키 두 개를 동시에 누를 수는 없어요."],
      ["@dev 미디어", "미디어 키 1개. HID Consumer 코드를 직접 지정할 수 있고, 키 입력과 섞을 수는 없어요."],
      ["@dev 마우스", "클릭(좌·우·가운데 조합), 스크롤 ±127, 이동·드래그 ±127px. 수정키는 control·shift·option 중 하나만 돼요."],
      ["하드웨어로 안 되는 것", "문자열(한글) 입력, 단계마다 다른 딜레이, 반복, 길게 누르기, 앱 실행"],
      ["@agt 맥 에이전트", "이 맥에서 도는 작은 백그라운드 프로그램이에요. 키패드에는 숨은 단축키(⌃⌥⇧⌘F16 등)만 저장되고, 에이전트가 그 단축키를 받아서 텍스트 입력, 앱·URL 열기, 쉘 명령, 단계별 매크로를 대신 실행해요. 에이전트가 꺼져 있으면 이 칸들은 아무 일도 안 해요. 최대 40칸."],
    ],
    "auto.keys": "키 입력", "auto.click": "{b} 클릭", "auto.drag": "{b} 드래그", "auto.scroll": "스크롤 {d}", "auto.up": "위", "auto.down": "아래",
    "auto.move": "포인터 {x},{y}", "auto.macro": "매크로 {n}단계", "auto.media": "미디어 {c}",
    "btn.left": "왼쪽", "btn.right": "오른쪽", "btn.middle": "가운데",
    "media.play": "재생/일시정지", "media.previous": "이전 곡", "media.next": "다음 곡", "media.stop": "정지",
    "media.volumedown": "볼륨 내리기", "media.mute": "음소거", "media.volumeup": "볼륨 올리기",
    "media.screenbrightnessdown": "밝기 내리기", "media.screenbrightnessup": "밝기 올리기",
    "media.calculator": "계산기", "media.screenlock": "화면 잠금", "media.favorites": "즐겨찾기",
    "media.webpagehome": "웹 홈", "media.webpageback": "웹 뒤로", "media.webpageforward": "웹 앞으로",
  },
};
function t(key, vars = {}) {
  const s = STR[LANG][key] ?? STR.en[key] ?? key;
  return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : s;
}
$$("[data-t]").forEach(el => el.textContent = t(el.dataset.t));
$("#previewDone").onclick = () => $("#previewDlg").close();
$("#helpDone").onclick = () => $("#helpDlg").close();
$("#agentToggle").title = t("agent.tip");

/* ---------- token + API ---------- */
// The server prints/opens http://127.0.0.1:PORT/#token=…; keep it and drop it from the address bar.
const TOKEN_KEY = "macropad-studio/token";
(function captureToken() {
  const m = location.hash.match(/token=([\w-]+)/);
  if (m) {
    try { localStorage.setItem(TOKEN_KEY, m[1]); } catch {}
    history.replaceState(null, "", location.pathname);
  }
})();
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("macropad-token") || ""; } catch { return ""; } };
const gate = () => $("#gate").classList.add("on");

async function api(method, path, body) {
  if (WEB) return webApi(method, path, body);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(path, { method, signal: ctl.signal,
      headers: { "Content-Type": "application/json", "X-Macropad-Token": token() },
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 401) { gate(); throw new Error("unauthorized"); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error(LANG === "ko" ? "서버가 응답하지 않아요" : "The server isn't responding");
    if (e instanceof TypeError) throw new Error(LANG === "ko" ? "서버에 연결할 수 없어요. server.py가 실행 중인지 확인하세요." : "Can't reach the server. Is server.py running?");
    throw e;
  } finally { clearTimeout(timer); }
}


/* ---------- web mode: no server, the browser talks to the keypad over WebHID ---------- */
// Served by server.py on localhost → local mode (agent, shell, …). Anywhere else (GitHub Pages) → web mode.
const WEB = new URLSearchParams(location.search).has("web") || !/^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
const WEB_STARTER = { rows: 3, columns: 4, knobs: 2, layers: [
  { led: "backlight white", slots: {
    b0: { type: "keys", steps: ["cmd-c"] }, b1: { type: "keys", steps: ["cmd-v"] }, b2: { type: "keys", steps: ["cmd-z"] },
    b3: { type: "keys", steps: ["cmd-shift-z"] }, b4: { type: "keys", steps: ["cmd-shift-4"] }, b5: { type: "keys", steps: ["ctrl-left"] },
    b6: { type: "keys", steps: ["ctrl-right"] }, b7: { type: "keys", steps: ["ctrl-up"] }, b8: { type: "media", code: "previous" },
    b9: { type: "media", code: "play" }, b10: { type: "media", code: "next" }, b11: { type: "keys", steps: ["ctrl-cmd-q"] },
    "k0.ccw": { type: "media", code: "volumedown" }, "k0.press": { type: "media", code: "mute" }, "k0.cw": { type: "media", code: "volumeup" },
    "k1.ccw": { type: "mouse", action: "wheel", delta: 1 }, "k1.press": { type: "mouse", action: "click", buttons: ["middle"] },
    "k1.cw": { type: "mouse", action: "wheel", delta: -1 } } },
  { led: "backlight blue", slots: {} }, { led: "backlight purple", slots: {} }] };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const HID_IDS = CH57X.SUPPORTED_IDS;
const isKeypad = d => HID_IDS.some(([v, p]) => d.vendorId === v && d.productId === p) && d.collections.some(c => c.usagePage === 0xff00);
const grantedKeypads = async () => navigator.hid ? (await navigator.hid.getDevices()).filter(isKeypad) : [];
async function requestKeypad() {
  if (!navigator.hid) throw new Error(t("web.unsupported"));
  const picked = await navigator.hid.requestDevice({ filters: HID_IDS.map(([vendorId, productId]) => ({ vendorId, productId, usagePage: 0xff00 })) });
  if (!picked.length) throw Object.assign(new Error("cancelled"), { name: "NotFoundError" });   // chooser dismissed
  const d = picked.find(isKeypad);
  if (!d) throw new Error(t("web.noDevice"));
  return d;
}
function outputLength(d, id) {
  for (const c of d.collections) for (const r of c.outputReports || [])
    if (r.reportId === id) return r.items.reduce((n, i) => n + i.reportSize * i.reportCount, 0) / 8;
  return 63;
}
async function hidSend(packets) {
  const d = (await grantedKeypads())[0] || await requestKeypad();
  if (!d.opened) await d.open();
  try {
    const len = outputLength(d, 3);
    for (const p of packets) {
      const buf = new Uint8Array(len);
      buf.set(p.subarray(1, 1 + len));
      await d.sendReport(p[0], buf);   // p[0] is the report id (3)
    }
  } finally { await d.close(); }
}
const webErrors = m => CH57X.slotErrors(m, { agent: false });
const hexLines = ps => ps.map(p => { let n = p.length; while (n > 1 && !p[n - 1]) n--; return [...p.subarray(0, n)].map(b => b.toString(16).padStart(2, "0")).join(" "); });
async function webApi(method, path, body) {
  const route = `${method} ${path}`;
  if (route === "GET /api/state") {
    let mapping = store.get("macropad-studio/draft"), warning = null;
    try { mapping = mapping ? CH57X.normalizeMapping(mapping) : structuredClone(WEB_STARTER); }
    catch (e) { warning = `Saved draft is invalid (${e.message}); showing the starter mapping`; mapping = structuredClone(WEB_STARTER); }
    const C = CH57X;
    return { mapping, uploaded: store.get("macropad-studio/uploaded"), warning, errors: webErrors(mapping),
      catalog: { modifiers: ["ctrl", "shift", "alt", "cmd", "rctrl", "rshift", "ralt", "rcmd"], keys: Object.keys(C.KEYS),
        media: Object.keys(C.MEDIA).filter(k => k !== "prev"), led_modes: Object.keys(C.LED_MODES), led_colors: Object.keys(C.LED_COLORS),
        limits: { layers: 3, max_steps: 18, max_delay: 6000, software_slots: C.MAX_SOFTWARE_SLOTS } } };
  }
  if (route === "PUT /api/mapping") { const m = CH57X.normalizeMapping(body); store.set("macropad-studio/draft", m); return { errors: webErrors(m) }; }
  if (route === "GET /api/status") return { devices: (await grantedKeypads()).map(d => ({ name: d.productName, id: `${d.vendorId.toString(16)}:${d.productId.toString(16)}` })), agent: { running: false } };
  if (route === "GET /api/apps") return [];
  if (route === "POST /api/preview") { const c = CH57X.compileMapping(body); return { packets: hexLines(c.packets), hardware: c.hardware, software: 0 }; }
  if (route === "POST /api/upload") {
    const c = CH57X.compileMapping(body);   // throws before the chooser opens if the mapping is invalid
    await hidSend(c.packets);
    store.set("macropad-studio/uploaded", CH57X.normalizeMapping(body));
    return { packets: c.packets.length, hardware: c.hardware, software: 0 };
  }
  throw new Error(t("web.agentOnly"));
}

/* SF Symbols-style line icons */
const P = {
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>',
  media: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  mouse: '<path d="M5 3.5l6.5 16 2.3-6.7 6.7-2.3z"/>',
  raw: '<path d="M8 4H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  open: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9.5 14.5l5-5M10.5 9.5h4v4"/>',
  shell: '<path d="M5 7l5 5-5 5M12.5 17H19"/>',
  macro: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".6"/><circle cx="4.5" cy="12" r=".6"/><circle cx="4.5" cy="18" r=".6"/>',
  speaker: '<path d="M4 9.5h3l4.5-4v13l-4.5-4H4z"/>',
  wave1: '<path d="M15 9.5a3.5 3.5 0 0 1 0 5"/>',
  wave2: '<path d="M17.5 7a7 7 0 0 1 0 10"/>',
  mutex: '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>',
  playpause: '<path d="M4 6l7 6-7 6z"/><path d="M15 6v12M19.5 6v12"/>',
  next: '<path d="M4 6l7 6-7 6zM11 6l7 6-7 6zM20 6v12"/>',
  prev: '<path d="M20 6l-7 6 7 6zM13 6l-7 6 7 6zM4 6v12"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  sunup: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  sundown: '<circle cx="12" cy="12" r="3.5"/><path d="M12 5.5v.01M12 18.5v.01M5.5 12h.01M18.5 12h.01M7.4 7.4h.01M16.6 16.6h.01M7.4 16.6h.01M16.6 7.4h.01"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  home: '<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  fwd: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  ccw: '<path d="M4.5 10a8 8 0 1 1 1.6 6.5"/><path d="M4 5v5h5"/>',
  cw: '<path d="M19.5 10a8 8 0 1 0-1.6 6.5"/><path d="M20 5v5h-5"/>',
};
const icon = (...names) => `<svg class="i" viewBox="0 0 24 24">${names.map(n => P[n] || "").join("")}</svg>`;

function toast(title, sub = "", kind = "info") {
  const el = document.createElement("div");
  el.className = "toast";
  const tl = { ok: ["t-open", "check"], err: ["t-media", "warn"], info: ["t-mouse", "info"] }[kind];
  el.innerHTML = `<span class="tile ${tl[0]}">${icon(tl[1])}</span><div><b>${esc(title)}</b>${sub ? `<span style="color:var(--label-2)">${esc(sub)}</span>` : ""}</div>`;
  $("#toasts").append(el);
  setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, kind === "err" ? 6000 : 3500);
}

/* ---------- vocabulary ---------- */
const DEV = new Set(["keys", "media", "mouse", "raw"]);
const TYPE_LIST = ["keys", "media", "mouse", "raw", "text", "open", "shell", "macro"];
const kindOf = ty => DEV.has(ty) ? "dev" : "agt";
const tile = (ty, lg = "") => TYPE_LIST.includes(ty) ? `<span class="tile t-${ty} ${lg}">${icon(ty)}</span>` : "";
const MEDIA_ICON = {
  play: ["playpause"], previous: ["prev"], prev: ["prev"], next: ["next"], stop: ["stop"],
  volumedown: ["speaker", "wave1"], mute: ["speaker", "mutex"], volumeup: ["speaker", "wave1", "wave2"],
  screenbrightnessdown: ["sundown"], screenbrightnessup: ["sunup"], calculator: ["calc"], screenlock: ["lock"],
  favorites: ["star"], webpagehome: ["home"], webpageback: ["back"], webpageforward: ["fwd"],
};
const mediaName = c => MEDIA_ICON[c] ? t("media." + (c === "prev" ? "previous" : c)) : t("auto.media", { c });
const MOD_SYM = { ctrl: "⌃", alt: "⌥", opt: "⌥", shift: "⇧", cmd: "⌘", win: "⌘", rctrl: "R⌃", ralt: "R⌥", ropt: "R⌥", rshift: "R⇧", rcmd: "R⌘", rwin: "R⌘" };
const MOD_ORDER = ["ctrl", "rctrl", "alt", "ralt", "shift", "rshift", "cmd", "rcmd"];
const KEY_SYM = {
  enter: "↩", escape: "esc", esc: "esc", backspace: "⌫", delete: "⌦", tab: "⇥", space: "Space", capslock: "⇪",
  left: "←", right: "→", up: "↑", down: "↓", pageup: "⇞", pagedown: "⇟", home: "↖", end: "↘",
  minus: "-", equal: "=", leftbracket: "[", rightbracket: "]", backslash: "\\", semicolon: ";", quote: "'",
  grave: "`", comma: ",", dot: ".", slash: "/", numpadenter: "⌤",
};
const LED_HEX = { white: "#f5f5f7", red: "#ff3b30", orange: "#ff9500", yellow: "#ffcc00", green: "#34c759", cyan: "#32ade6", blue: "#007aff", purple: "#af52de" };
const KNOB_ICON = { ccw: "ccw", press: "", cw: "cw" };

function prettyAccord(a) {
  const parts = String(a).toLowerCase().split("-");
  const key = parts.pop();
  const mods = parts;
  let keyTxt;
  if (MOD_SYM[key]) { mods.push(key); keyTxt = ""; }
  else keyTxt = KEY_SYM[key] ?? (key.length === 1 ? key.toUpperCase() : key.replace(/^f(\d+)$/, "F$1").replace(/^numpad/, "num").replace(/^<(\d+)>$/, "#$1"));
  return mods.sort((x, y) => MOD_ORDER.indexOf(x) - MOD_ORDER.indexOf(y)).map(x => MOD_SYM[x] || x).join("") + keyTxt;
}
function autoLabel(a) {
  if (!a) return "";
  switch (a.type) {
    case "keys": return (a.steps || []).map(prettyAccord).join(" ") || t("auto.keys");
    case "media": return mediaName(a.code);
    case "mouse": {
      const b = (a.buttons || []).map(x => t("btn." + x)).join("+");
      const mod = a.modifier ? MOD_SYM[a.modifier] || "" : "";
      if (a.action === "click") return mod + t("auto.click", { b });
      if (a.action === "wheel") { const d = num(a.delta); return mod + t("auto.scroll", { d: (d > 0 ? t("auto.up") : t("auto.down")) + (Math.abs(d) !== 1 ? " " + Math.abs(d) : "") }); }
      if (a.action === "move") return mod + t("auto.move", { x: num(a.dx), y: num(a.dy) });
      return mod + t("auto.drag", { b });
    }
    case "raw": return a.expr || t("type.raw");
    case "text": return a.text ? `“${a.text.replace(/\n/g, " ")}”` : t("type.text");
    case "open": { const s = a.target || ""; return s ? (s.includes("://") ? s.replace(/^\w+:\/\/(www\.)?/, "").split("/")[0] : s.split("/").pop().replace(/\.app$/, "")) : t("type.open"); }
    case "shell": return a.command || t("type.shell");
    case "macro": return t("auto.macro", { n: (a.steps || []).length });
  }
  return String(a.type);
}
const label = a => (a && a.label) || autoLabel(a);
function legendHTML(a) {
  if (!a) return "";
  const ic = a.type === "media" && MEDIA_ICON[a.code] ? icon(...MEDIA_ICON[a.code])
           : a.type !== "keys" && a.type !== "media" && TYPE_LIST.includes(a.type) ? icon(a.type) : "";
  return ic + esc(label(a));
}

/* ---------- state ---------- */
let S = { mapping: null, uploaded: null, errors: {}, catalog: null, layer: 0, sel: "b0", clip: null, apps: [], agent: {}, devices: null, seenAt: null, hit: null, picking: false, uploading: false };
const L = () => S.mapping.layers[S.layer];
const cur = () => L().slots[S.sel];
const nButtons = () => num(S.mapping.rows) * num(S.mapping.columns);
function slotNames() {
  const names = [...Array(nButtons()).keys()].map(i => "b" + i);
  for (let k = 0; k < num(S.mapping.knobs); k++) for (const a of ["ccw", "press", "cw"]) names.push(`k${k}.${a}`);
  return names;
}
function deviceView(m) {
  if (!m) return null;
  return JSON.stringify(m.layers.map(l => ({ led: l.led, slots: Object.fromEntries(Object.entries(l.slots).sort().map(([k, v]) => { const { label, ...rest } = v; return [k, rest]; })) })));
}
const isDirty = () => deviceView(S.mapping) !== deviceView(S.uploaded);

let saveTimer, savePending = null;
function changed({ inspector = true, save = true } = {}) {
  renderLayers(); renderDevice(); renderUsage(); renderUpload();
  if (inspector) { renderLayerPanel(); renderInspector(); }
  if (!save) return;
  clearTimeout(saveTimer);
  savePending = async () => {
    savePending = null;
    try {
      const r = await api("PUT", "/api/mapping", S.mapping);
      S.errors = r.errors;
      renderDevice(); renderUpload(); renderErrorNote();
    } catch (e) { if (e.message !== "unauthorized") toast(t("save.fail"), e.message, "err"); }
  };
  saveTimer = setTimeout(savePending, 250);
}
function setSlot(a) { if (a) L().slots[S.sel] = a; else delete L().slots[S.sel]; }
function select(name) { S.sel = name; S.picking = false; renderDevice(); renderInspector(); }

/* ---------- toolbar ---------- */
function renderUpload() {
  if (S.uploading) return;
  const b = $("#uploadBtn");
  const errs = Object.keys(S.errors).length, dirty = isDirty();
  b.classList.toggle("primary", dirty && !errs);
  b.disabled = errs > 0;
  b.innerHTML = errs ? esc(t("up.errors", { n: errs })) : dirty ? esc(t("up.dirty")) : `${icon("check")} ${esc(t("up.synced"))}`;
  b.title = errs ? t("up.tipErr") : dirty ? t("up.tipDirty") : t("up.tipSynced");
}
function renderStatus() {
  const d = S.devices?.[0];
  $("#devStatus").innerHTML = S.devices === null ? `<span class="dot"></span>${esc(t("dev.checking"))}`
    : d ? `<span class="dot on"></span>${esc(t("dev.on"))}` : `<span class="dot off"></span>${esc(t("dev.off"))}`;
  $("#devStatus").title = d ? `${d.name} (${d.id})` : "";
  const connect = WEB && S.devices !== null && !d;
  $("#devStatus").classList.toggle("link", connect);
  if (connect) $("#devStatus").innerHTML = `<span class="dot off"></span>${esc(t("web.connect"))}`;
  $("#agentToggle").setAttribute("aria-checked", !!S.agent.running);
  renderHit();
}

/* ---------- device ---------- */
function ledColor(led) {
  const [mode, color] = String(led || "off").split(" ");
  return mode === "off" ? "transparent" : LED_HEX[color || "white"] || "transparent";
}
const layerName = (l, i) => l.name || t("layer", { n: i + 1 });
function renderLayers() {
  $("#layers").innerHTML = S.mapping.layers.map((l, i) => `
    <button role="tab" aria-selected="${i === S.layer}" data-i="${i}"><span class="lamp" style="background:${ledColor(l.led)}"></span>${esc(layerName(l, i))}</button>`).join("");
  $$("#layers button").forEach(b => b.onclick = () => { S.layer = +b.dataset.i; S.picking = false; changed(); });
}
function slotTitle(n) {
  if (n.startsWith("b")) return t("slot.button", { n: +n.slice(1) + 1 });
  const [k, act] = n.slice(1).split(".");
  return t("slot.knob", { n: +k + 1, a: t("knob." + act) });
}
function renderDevice() {
  const err = n => S.errors[`${S.layer}:${n}`] ? "error" : "";
  let h = `<div class="keys" style="--cols:${num(S.mapping.columns, 4)}">`;
  for (let i = 0; i < nButtons(); i++) {
    const n = "b" + i, a = L().slots[n];
    h += `<button class="key ${a ? "" : "blank"} ${err(n)}" data-slot="${n}" draggable="true" aria-pressed="${S.sel === n}" aria-label="${esc(slotTitle(n))}">
      <span class="meta"><span>${i + 1}</span>${a ? `<span class="cat ${kindOf(a.type)}"></span>` : ""}</span>
      <span class="legend">${a ? legendHTML(a) : esc(t("empty"))}</span></button>`;
  }
  h += `</div><div class="knobs">`;
  for (let k = 0; k < num(S.mapping.knobs); k++) {
    const turn = act => {
      const n = `k${k}.${act}`, a = L().slots[n];
      return `<button class="turn ${a ? "" : "blank"} ${err(n)}" data-slot="${n}" draggable="true" aria-pressed="${S.sel === n}" aria-label="${esc(slotTitle(n))}">
        ${a ? `<span class="cat ${kindOf(a.type)}"></span>` : ""}<span class="arr">${icon(KNOB_ICON[act])}</span><span class="t">${esc(a ? label(a) : t("knob." + act))}</span></button>`;
    };
    const pn = `k${k}.press`, pa = L().slots[pn];
    h += `<div class="knob">${turn("ccw")}
      <button class="crown ${err(pn)}" data-slot="${pn}" draggable="true" aria-pressed="${S.sel === pn}" aria-label="${esc(slotTitle(pn))}" title="${esc(slotTitle(pn))}"></button>
      ${turn("cw")}<div class="press-label">${esc(pa ? label(pa) : t("knob.pressShort"))}</div></div>`;
  }
  h += `</div>`;
  const dev = $("#device");
  dev.innerHTML = h;
  $$("[data-slot]", dev).forEach(el => {
    el.onclick = () => select(el.dataset.slot);
    el.ondragstart = e => { e.dataTransfer.setData("text/plain", el.dataset.slot); e.dataTransfer.effectAllowed = "move"; };
    el.ondragover = e => { e.preventDefault(); el.classList.add("dragover"); };
    el.ondragleave = () => el.classList.remove("dragover");
    el.ondrop = e => {
      e.preventDefault(); el.classList.remove("dragover");
      const from = e.dataTransfer.getData("text/plain"), to = el.dataset.slot;
      if (!from || from === to || !slotNames().includes(from)) return;
      const s = L().slots, a = s[from], b = s[to];
      if (b) s[from] = b; else delete s[from];
      if (a) s[to] = a; else delete s[to];
      S.sel = to; changed();
    };
  });
}

/* ---------- layer + usage ---------- */
function renderLayerPanel() {
  const l = L();
  const [mode, color] = String(l.led || "off").split(" ");
  $("#layerPanel").innerHTML = `
    <div class="sec-h">${esc(t("layer", { n: S.layer + 1 }))}</div>
    <div class="group">
      <div class="row"><span class="k">${esc(t("name"))}</span><input class="field" id="layerName" value="${esc(l.name || "")}" placeholder="${esc(t("layer", { n: S.layer + 1 }))}"></div>
      <div class="row"><span class="k">${esc(t("led"))}</span><div class="seg" id="ledMode">${S.catalog.led_modes.map(m => `<button data-m="${esc(m)}" aria-pressed="${m === mode}">${esc(t("led." + m))}</button>`).join("")}</div></div>
      <div class="row"><span class="k">${esc(t("color"))}</span><div class="swatches">${S.catalog.led_colors.map(c => `<button class="swatch" data-c="${esc(c)}" title="${esc(c)}" style="background:${LED_HEX[c] || "#888"}"
          aria-pressed="${mode !== "off" && (color || "white") === c}" ${mode === "off" || (c === "white" && mode !== "backlight") ? "disabled" : ""}></button>`).join("")}</div></div>
    </div>
    <div class="footer">${esc(t("led.footer"))}</div>`;
  $("#layerName").oninput = e => { if (e.target.value) l.name = e.target.value; else delete l.name; changed({ inspector: false }); };
  $$("#ledMode button").forEach(b => b.onclick = () => {
    const m = b.dataset.m;
    let c = color || "white";
    if (m !== "backlight" && c === "white") c = "blue";
    l.led = m === "off" ? "off" : `${m} ${c}`;
    changed({ inspector: false }); renderLayerPanel();
  });
  $$("#layerPanel .swatch").forEach(b => b.onclick = () => { l.led = `${mode} ${b.dataset.c}`; changed({ inspector: false }); renderLayerPanel(); });
}
function renderUsage() {
  let dev = 0, agt = 0;
  const names = slotNames();
  const rows = S.mapping.layers.map(l => names.map(n => {
    const a = l.slots[n]; const k = a ? kindOf(a.type) : "";
    if (k === "dev") dev++; if (k === "agt") agt++;
    return k;
  }));
  const total = names.length * rows.length;
  $("#usagePanel").innerHTML = `
    <div class="sec-h">${esc(t("usage"))}</div>
    <div class="group">
      <div class="stack">
        <div class="usage"><b>${dev + agt}</b><span>${esc(t("usage.of", { n: total }))}</span></div>
        <div class="cells">${rows.map(r => `<div class="r" style="grid-template-columns:repeat(${names.length},1fr)">${r.map(c => `<i class="${c}"></i>`).join("")}</div>`).join("")}</div>
      </div>
      <div class="row"><span class="cat dev"></span><span class="k">${esc(t("usage.dev"))}</span><span class="v">${dev}</span></div>
      ${WEB && !agt ? "" : `<div class="row"><span class="cat agt"></span><span class="k">${esc(t("usage.agt"))}</span><span class="v">${agt} / ${num(S.catalog.limits.software_slots)}</span></div>`}
    </div>`;
}

/* ---------- inspector ---------- */
function renderErrorNote() {
  const box = $("#errBox");
  if (!box) return;
  const e = S.errors[`${S.layer}:${S.sel}`];
  box.innerHTML = e ? `<div class="row err">${icon("warn")}<span>${esc(e)}</span></div>` : "";
  box.style.display = e ? "" : "none";
}
function renderInspector() {
  const a = cur();
  const el = $("#inspector");
  el.innerHTML = `
    <div class="ins-head">
      <div><div class="sub">${esc(layerName(L(), S.layer))}</div><h2>${esc(slotTitle(S.sel))}</h2></div>
      <div class="tools">
        <button class="btn plain" id="copyBtn" ${a ? "" : "disabled"}>${esc(t("copy"))}</button>
        <button class="btn plain" id="pasteBtn" ${S.clip ? "" : "disabled"}>${esc(t("paste"))}</button>
        <button class="btn plain destructive" id="clearBtn" ${a ? "" : "disabled"}>${esc(t("clear"))}</button>
      </div>
    </div>
    <div id="insBody" style="display:flex;flex-direction:column;gap:20px"></div>`;
  $("#copyBtn").onclick = () => { S.clip = structuredClone(a); toast(t("copied"), t("copiedSub")); renderInspector(); };
  $("#pasteBtn").onclick = () => { setSlot(structuredClone(S.clip)); S.picking = false; changed(); };
  $("#clearBtn").onclick = () => { setSlot(null); S.picking = false; changed(); };

  const body = $("#insBody");
  if (!a || S.picking || !TYPE_LIST.includes(a.type)) return renderPicker(body, a);
  const k = kindOf(a.type);
  body.innerHTML = `
    <div>
      <div class="group">
        <div class="row">${tile(a.type, "lg")}<div class="k"><div style="font-weight:600">${esc(t("type." + a.type))}</div><div class="tag"><span class="cat ${k}"></span>${esc(t("kind." + k))}</div></div>
          <button class="btn" id="changeType">${esc(t("change"))}</button></div>
        <div class="row"><span class="k">${esc(t("keycap"))}</span><input class="field" id="labelInput" value="${esc(a.label || "")}" placeholder="${esc(autoLabel(a))}"></div>
        <div id="errBox"></div>
      </div>
      <div class="footer">${k === "dev" ? esc(t("note.dev")) : esc(t("note.agt")) + (S.agent.running ? "" : ` <b>${esc(t("note.agtOff"))}</b>`)}</div>
    </div>
    <div id="edBody" style="display:flex;flex-direction:column;gap:20px"></div>`;
  $("#changeType").onclick = () => { S.picking = true; renderInspector(); };
  $("#labelInput").oninput = e => { if (e.target.value) a.label = e.target.value; else delete a.label; changed({ inspector: false }); };
  renderErrorNote();
  ({ keys: edKeys, media: edMedia, mouse: edMouse, raw: edRaw, text: edText, open: edOpen, shell: edShell, macro: edMacro })[a.type]($("#edBody"), a);
}
function renderPicker(body, a) {
  const opt = ty => `<button class="row opt" data-t="${ty}" aria-pressed="${a?.type === ty}">${tile(ty)}
      <span class="k"><div>${esc(t("type." + ty))}</div><div class="d">${esc(t("type." + ty + ".d"))}</div></span><span class="chev">${a?.type === ty ? icon("check") : "›"}</span></button>`;
  body.innerHTML = `
    <div><div class="sec-h">${esc(t("pick.dev"))} <small>${esc(t("pick.devSub"))}</small></div>
      <div class="group">${["keys", "media", "mouse", "raw"].map(opt).join("")}</div></div>
    <div><div class="sec-h">${esc(t("pick.agt"))} <small>${esc(t("pick.agtSub"))}</small></div>
      <div class="group">${["text", "open", "shell", "macro"].map(opt).join("")}</div>
      <div class="footer">${esc(t(WEB ? "web.agentOnly" : "pick.agtFooter"))}</div></div>
    ${a && TYPE_LIST.includes(a.type) ? `<div><button class="btn lg" id="cancelPick">${esc(t("cancel"))}</button></div>` : ""}`;
  if (WEB) $$(".opt", body).forEach(b => { if (!DEV.has(b.dataset.t)) b.disabled = true; });
  $$(".opt", body).forEach(b => b.onclick = () => {
    const ty = b.dataset.t;
    S.picking = false;
    if (a?.type !== ty) setSlot({ ...defaultAction(ty), ...(a?.label ? { label: a.label } : {}) });
    changed();
  });
  const c = $("#cancelPick", body); if (c) c.onclick = () => { S.picking = false; renderInspector(); };
}
function defaultAction(ty) {
  return {
    keys: { type: "keys", steps: [], delay: 0 },
    media: { type: "media", code: "play" },
    mouse: { type: "mouse", action: "click", buttons: ["left"], modifier: "" },
    raw: { type: "raw", expr: "" },
    text: { type: "text", text: "" },
    open: { type: "open", target: "" },
    shell: { type: "shell", command: "" },
    macro: { type: "macro", steps: [] },
  }[ty];
}
const soft = () => changed({ inspector: false });
const section = (title, inner, footerHTML = "") => `<div>${title ? `<div class="sec-h">${title}</div>` : ""}<div class="group">${inner}</div>${footerHTML ? `<div class="footer">${footerHTML}</div>` : ""}</div>`;

/* keys */
function edKeys(body, a) {
  const max = num(S.catalog.limits.max_steps, 18), maxDelay = num(S.catalog.limits.max_delay, 6000);
  if (!Array.isArray(a.steps)) a.steps = [];
  const delay = num(a.delay);
  body.innerHTML = section(`${esc(t("keys.title"))} <small id="stepCount">${a.steps.length} / ${max}</small>`,
    `<div class="stack"><div class="chips" id="chips"></div>
       <div class="hrow" style="margin-top:9px"><button class="btn rec" id="recBtn"><span class="rd"></span><span>${esc(t("keys.rec"))}</span></button>
       <span class="unit">${esc(t("keys.recHint"))}</span></div></div>`, t("keys.footer"))
    + section(esc(t("keys.delay")),
    `<div class="stack"><div class="range"><input type="range" min="0" max="${maxDelay}" step="10" id="delayR" value="${delay}">
      <input class="field num" type="number" min="0" max="${maxDelay}" id="delayN" value="${delay}"><span class="unit">ms</span></div></div>`, esc(t("keys.delayFooter")));
  const chips = $("#chips", body);
  const count = () => $("#stepCount", body).textContent = `${a.steps.length} / ${max}`;
  const draw = () => {
    chips.innerHTML = a.steps.map((s, i) => `${i ? '<span class="then">›</span>' : ""}<span class="kbd" title="${esc(s)}"><span class="n">${i + 1}</span>${esc(prettyAccord(s))}<button data-i="${i}" aria-label="${esc(t("macro.del"))}">✕</button></span>`).join("")
      + `<input id="addKey" list="keyList" placeholder="${a.steps.length ? "" : esc(t("keys.ph"))}">`;
    $$("button", chips).forEach(b => b.onclick = () => { a.steps.splice(+b.dataset.i, 1); draw(); soft(); count(); });
    const inp = $("#addKey", chips);
    inp.onkeydown = e => {
      if (e.key === "Enter" && inp.value.trim()) {
        e.preventDefault();
        inp.value.split(",").map(s => s.trim()).filter(Boolean).forEach(s => a.steps.length < max && a.steps.push(s.toLowerCase()));
        draw(); soft(); count(); $("#addKey").focus();
      } else if (e.key === "Backspace" && !inp.value && a.steps.length) { a.steps.pop(); draw(); soft(); count(); $("#addKey").focus(); }
    };
  };
  draw();
  recorder($("#recBtn", body), acc => { if (a.steps.length < max) { a.steps.push(acc); draw(); soft(); count(); } });
  const r = $("#delayR", body), n = $("#delayN", body);
  r.oninput = () => { n.value = r.value; a.delay = num(r.value); soft(); };
  n.oninput = () => { r.value = n.value; a.delay = Math.max(0, Math.min(maxDelay, num(n.value))); soft(); };
}

/* media */
function edMedia(body, a) {
  const known = S.catalog.media, custom = !known.includes(a.code);
  body.innerHTML = section(esc(t("media.title")),
    `<div class="stack"><div class="tiles">${known.map(c => `<button data-c="${esc(c)}" aria-pressed="${a.code === c}">${icon(...(MEDIA_ICON[c] || ["media"]))}${esc(mediaName(c))}</button>`).join("")}</div></div>
     <div class="row"><span class="k">${esc(t("media.custom"))}</span><input class="field mono" id="customCode" placeholder="0x1B6" value="${custom ? esc(a.code) : ""}"></div>`,
    esc(t("media.footer")));
  $$(".tiles button", body).forEach(b => b.onclick = () => { a.code = b.dataset.c; changed(); });
  $("#customCode", body).oninput = e => { if (e.target.value.trim()) { a.code = e.target.value.trim(); $$(".tiles button", body).forEach(x => x.setAttribute("aria-pressed", false)); soft(); } };
}

/* mouse */
function edMouse(body, a) {
  const acts = ["click", "wheel", "move", "drag"];
  const seg = (id, items, pressed) => `<div class="seg" id="${id}">${items.map(([k, v]) => `<button data-v="${esc(k)}" aria-pressed="${pressed(k)}">${esc(v)}</button>`).join("")}</div>`;
  let rows = `<div class="row"><span class="k">${esc(t("mouse.action"))}</span>${seg("mAct", acts.map(k => [k, t("mouse." + k)]), k => a.action === k)}</div>`;
  if (a.action === "click" || a.action === "drag")
    rows += `<div class="row"><span class="k">${esc(t("mouse.buttons"))}</span>${seg("mBtn", ["left", "middle", "right"].map(k => [k, t("mouse." + k)]), k => (a.buttons || []).includes(k))}</div>`;
  if (a.action === "wheel") {
    const d = num(a.delta, 1);
    rows += `<div class="stack"><div class="k"><span>${esc(t("mouse.amount"))}</span><small>${esc(t("mouse.amountSub"))}</small></div><div class="range"><input type="range" min="-20" max="20" id="wR" value="${d}"><input class="field num" type="number" min="-127" max="127" id="wN" value="${d}"></div></div>`;
  }
  if (a.action === "move" || a.action === "drag")
    rows += `<div class="row"><span class="k">X</span><input class="field num" type="number" min="-127" max="127" id="dx" value="${num(a.dx)}"><span class="unit">px</span></div>
             <div class="row"><span class="k">Y</span><input class="field num" type="number" min="-127" max="127" id="dy" value="${num(a.dy)}"><span class="unit">px</span></div>`;
  rows += `<div class="row"><span class="k">${esc(t("mouse.mod"))}</span>${seg("mMod", [["", t("mouse.none")], ["ctrl", "⌃"], ["shift", "⇧"], ["alt", "⌥"]], k => (a.modifier || "") === k)}</div>`;
  body.innerHTML = section(esc(t("mouse.title")), rows, esc(t("mouse.footer")));
  $$("#mAct button", body).forEach(b => b.onclick = () => {
    a.action = b.dataset.v;
    if (a.action === "wheel" || a.action === "move") delete a.buttons;
    if (a.action === "wheel" && a.delta == null) a.delta = 1;
    if ((a.action === "click" || a.action === "drag") && !(a.buttons || []).length) a.buttons = ["left"];
    changed();
  });
  $$("#mBtn button", body).forEach(b => b.onclick = () => {
    const set = new Set(a.buttons || []); set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v);
    a.buttons = [...set]; changed();
  });
  $$("#mMod button", body).forEach(b => b.onclick = () => { a.modifier = b.dataset.v; changed(); });
  const wr = $("#wR", body), wn = $("#wN", body);
  if (wr) { wr.oninput = () => { wn.value = wr.value; a.delta = num(wr.value); soft(); }; wn.oninput = () => { wr.value = wn.value; a.delta = num(wn.value); soft(); }; }
  for (const k of ["dx", "dy"]) { const i = $("#" + k, body); if (i) i.oninput = () => { a[k] = num(i.value); soft(); }; }
}

/* raw */
function edRaw(body, a) {
  body.innerHTML = section(esc(t("raw.title")), `<div class="stack"><input class="field mono" id="expr" value="${esc(a.expr)}" placeholder="{delay(100)}cmd-a,cmd-c"></div>`,
    `${esc(t("raw.footer"))} <code>ctrl-a,b</code> <code>{delay(200)}left,right</code> <code>shift-wheel(3)</code> <code>click+rclick</code> <code>consumer(0x1b6)</code> <code>&lt;104&gt;</code>`);
  $("#expr", body).oninput = e => { a.expr = e.target.value; soft(); };
}

/* agent editors */
function testButton(body, a) {
  if (WEB) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `<button class="btn lg">${esc(t("test"))}</button><div class="footer" style="margin-left:2px">${esc(t("test.hint"))}</div>`;
  $("button", wrap).onclick = async () => {
    try { await api("POST", "/api/test", a); toast(t("test.toast"), t("test.toastSub")); }
    catch (e) { toast(t("test.fail"), e.message, "err"); }
  };
  body.append(wrap);
}
function edText(body, a) {
  body.innerHTML = section(esc(t("text.title")), `<div class="stack"><textarea class="field" id="txt" placeholder="${esc(t("text.ph"))}">${esc(a.text)}</textarea></div>`, esc(t("text.footer")));
  $("#txt", body).oninput = e => { a.text = e.target.value; soft(); };
  testButton(body, a);
}
async function loadApps() { if (!S.apps.length) S.apps = await api("GET", "/api/apps"); return S.apps; }
function fillApps(dl) { loadApps().then(apps => { if (dl) dl.innerHTML = apps.map(x => `<option value="${esc(x)}">`).join(""); }).catch(() => {}); }
function edOpen(body, a) {
  body.innerHTML = section(esc(t("open.title")), `<div class="stack"><input class="field" id="tgt" list="appList" value="${esc(a.target)}" placeholder="${esc(t("open.ph"))}"></div>`, esc(t("open.footer"))) + `<datalist id="appList"></datalist>`;
  $("#tgt", body).oninput = e => { a.target = e.target.value; soft(); };
  fillApps($("#appList", body));
  testButton(body, a);
}
function edShell(body, a) {
  body.innerHTML = section(esc(t("shell.title")), `<div class="stack"><textarea class="field mono" id="cmd" placeholder="shortcuts run &quot;Focus&quot;">${esc(a.command)}</textarea></div>`, t("shell.footer"));
  $("#cmd", body).oninput = e => { a.command = e.target.value; soft(); };
  testButton(body, a);
}

const STEP_KINDS = ["keys", "text", "wait", "open", "shell"];
function edMacro(body, a) {
  if (!Array.isArray(a.steps)) a.steps = [];
  body.innerHTML = section(esc(t("macro.title")), `<div id="steps"></div><div class="adds">${STEP_KINDS.map(k => `<button class="btn" data-add="${k}">+ ${esc(t("step." + k))}</button>`).join("")}</div>`,
    esc(t("macro.footer"))) + `<datalist id="appList2"></datalist>`;
  const list = $("#steps", body);
  const draw = () => {
    list.innerHTML = a.steps.length ? "" : `<div class="row" style="color:var(--label-2)">${esc(t("macro.first"))}</div>`;
    a.steps.forEach((st, i) => {
      const d = document.createElement("div"); d.className = "step";
      const ms = num(st.ms), rep = Math.max(1, num(st.repeat, 1));
      const ph = { keys: t("macro.keysPh"), text: t("macro.textPh"), shell: t("macro.shellPh"), open: t("open.ph") }[st.do] || "";
      d.innerHTML = `<span class="no">${i + 1}</span><div class="step-h">
          <select>${STEP_KINDS.map(k => `<option value="${k}" ${st.do === k ? "selected" : ""}>${esc(t("step." + k))}</option>`).join("")}</select>
          <span class="sp"></span>${st.do === "keys" ? `<button class="btn rec" data-rec><span class="rd"></span><span>${esc(t("keys.rec"))}</span></button>` : ""}
          <button class="ib" data-up title="${esc(t("macro.up"))}">↑</button><button class="ib" data-down title="${esc(t("macro.down"))}">↓</button><button class="ib" data-del title="${esc(t("macro.del"))}">✕</button></div>
        ${st.do === "wait"
          ? `<div class="range"><input type="range" min="0" max="5000" step="50" value="${ms}"><input class="field num" type="number" min="0" value="${ms}"><span class="unit">ms</span></div>`
          : st.do === "text" || st.do === "shell"
            ? `<textarea class="field ${st.do === "shell" ? "mono" : ""}" style="min-height:56px" placeholder="${esc(ph)}">${esc(st.value || "")}</textarea>`
            : `<input class="field ${st.do === "keys" ? "mono" : ""}" ${st.do === "open" ? 'list="appList2"' : ""} value="${esc(st.value || "")}" placeholder="${esc(ph)}">`}
        ${st.do !== "wait" ? `<div class="rep">${esc(t("macro.repeat"))} <input class="field num" style="width:56px!important" type="number" min="1" max="999" value="${rep}"> ${esc(t("macro.times"))}</div>` : ""}`;
      $("select", d).onchange = e => { a.steps[i] = e.target.value === "wait" ? { do: "wait", ms: 300 } : { do: e.target.value, value: "" }; draw(); soft(); };
      $("[data-up]", d).onclick = () => { if (i) { [a.steps[i - 1], a.steps[i]] = [a.steps[i], a.steps[i - 1]]; draw(); soft(); } };
      $("[data-down]", d).onclick = () => { if (i < a.steps.length - 1) { [a.steps[i + 1], a.steps[i]] = [a.steps[i], a.steps[i + 1]]; draw(); soft(); } };
      $("[data-del]", d).onclick = () => { a.steps.splice(i, 1); draw(); soft(); };
      if (st.do === "wait") {
        const [r, n] = $$("input", d);
        r.oninput = () => { n.value = r.value; st.ms = num(r.value); soft(); };
        n.oninput = () => { r.value = n.value; st.ms = Math.max(0, num(n.value)); soft(); };
      } else {
        const v = $("textarea, .field:not([type=number])", d);
        v.oninput = () => { st.value = v.value; soft(); };
        const repEl = $(".rep input", d);
        repEl.oninput = () => { st.repeat = Math.max(1, num(repEl.value, 1)); soft(); };
        const rb = $("[data-rec]", d);
        if (rb) recorder(rb, acc => { st.value = st.value ? `${st.value}, ${acc}` : acc; v.value = st.value; soft(); });
      }
      list.append(d);
    });
  };
  draw();
  $$("[data-add]", body).forEach(b => b.onclick = () => {
    const k = b.dataset.add;
    a.steps.push(k === "wait" ? { do: "wait", ms: 300 } : { do: k, value: "" });
    draw(); soft();
  });
  fillApps($("#appList2", body));
  testButton(body, a);
}

/* ---------- key recorder ---------- */
const CODE_MAP = {
  Enter: "enter", NumpadEnter: "numpadenter", Escape: "escape", Backspace: "backspace", Tab: "tab", Space: "space",
  Minus: "minus", Equal: "equal", BracketLeft: "leftbracket", BracketRight: "rightbracket", Backslash: "backslash",
  Semicolon: "semicolon", Quote: "quote", Backquote: "grave", Comma: "comma", Period: "dot", Slash: "slash",
  CapsLock: "capslock", PrintScreen: "printscreen", ScrollLock: "scrolllock", Pause: "pause", Insert: "insert",
  Home: "home", PageUp: "pageup", Delete: "delete", End: "end", PageDown: "pagedown",
  ArrowRight: "right", ArrowLeft: "left", ArrowDown: "down", ArrowUp: "up", NumLock: "numlock",
  NumpadDivide: "numpadslash", NumpadMultiply: "numpadasterisk", NumpadSubtract: "numpadminus", NumpadAdd: "numpadplus",
  NumpadDecimal: "numpaddot", NumpadEqual: "numpadequal", IntlBackslash: "nonusbackslash", ContextMenu: "application",
};
const MOD_CODES = { ControlLeft: "ctrl", ControlRight: "rctrl", ShiftLeft: "shift", ShiftRight: "rshift", AltLeft: "alt", AltRight: "ralt", MetaLeft: "cmd", MetaRight: "rcmd" };
function codeToKey(code) {
  if (CODE_MAP[code]) return CODE_MAP[code];
  let m;
  if ((m = code.match(/^Key([A-Z])$/))) return m[1].toLowerCase();
  if ((m = code.match(/^Digit(\d)$/))) return m[1];
  if ((m = code.match(/^Numpad(\d)$/))) return "numpad" + m[1];
  if ((m = code.match(/^F(\d+)$/))) return "f" + m[1];
  return null;
}
const sortMods = mods => [...mods].sort((x, y) => MOD_ORDER.indexOf(x) - MOD_ORDER.indexOf(y));
let activeRec = null;
function recorder(btn, onAccord) {
  const txt = $("span:last-child", btn);
  btn.onclick = () => {
    if (activeRec) { const same = activeRec.btn === btn; activeRec.stop(); if (same) return; }
    const held = new Set(); let usedKey = false;
    const down = e => {
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      if (MOD_CODES[e.code]) { held.add(MOD_CODES[e.code]); usedKey = false; return; }
      const k = codeToKey(e.code);
      if (!k) { toast(t("keys.cant"), e.code, "err"); return; }
      usedKey = true;
      onAccord([...sortMods(held), k].join("-"));
    };
    const up = e => {
      e.preventDefault();
      const m = MOD_CODES[e.code];
      if (!m) return;
      if (!usedKey && held.size) onAccord(sortMods(held).join("-"));
      held.delete(m);
      if (!held.size) usedKey = false;
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    btn.classList.add("on"); txt.textContent = t("keys.recStop");
    activeRec = { btn, stop() { window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); btn.classList.remove("on"); txt.textContent = t("keys.rec"); activeRec = null; } };
  };
}

/* ---------- live key test ---------- */
// The keypad types like a keyboard, so a press that reaches this page is matched against the mapping on the keypad.
// Agent slots are swallowed by the agent before the page sees them; those arrive through poll() instead.
const MEDIA_CODES = { AudioVolumeUp: "volumeup", AudioVolumeDown: "volumedown", AudioVolumeMute: "mute", MediaPlayPause: "play", MediaTrackNext: "next", MediaTrackPrevious: "previous", MediaStop: "stop" };
const accordId = step => { try { const [m, c] = CH57X.parseAccord(String(step).trim().toLowerCase()); return c ? `${(m | (m >> 4)) & 0x0f}:${c}` : null; } catch { return null; } };
let hitQuiet = 0, hitFade;
function renderHit() {
  const el = $("#hitStatus");
  const h = S.hit;
  el.textContent = h ? t("hit.pressed", { where: h.where }) : S.devices?.length && S.uploaded ? t("hit.hint") : "";
  el.title = h ? h.where : "";
}
function showHit(layer, slot) {
  const l = S.uploaded?.layers?.[layer], a = l?.slots?.[slot];
  if (!a) return;
  S.hit = { layer, slot, where: `${layerName(l, layer)} · ${slotTitle(slot)} · ${label(a)}` };
  renderHit();
  const st = $("#hitStatus");
  st.classList.add("fresh"); clearTimeout(hitFade); hitFade = setTimeout(() => st.classList.remove("fresh"), 3000);
  const el = layer === S.layer ? $(`#device [data-slot="${slot}"]`) : $(`#layers button[data-i="${layer}"]`);
  if (el) { el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); }
}
window.addEventListener("keydown", e => {
  if (activeRec || e.repeat || !S.uploaded || MOD_CODES[e.code]) return;
  if (e.target.closest?.("input, textarea, select, [contenteditable]") || $("dialog[open]")) return;
  if (performance.now() < hitQuiet) return;
  const media = MEDIA_CODES[e.code], key = codeToKey(e.code);
  const mods = (e.ctrlKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
  const id = key && accordId([...sortMods(new Set([e.ctrlKey && "ctrl", e.shiftKey && "shift", e.altKey && "alt", e.metaKey && "cmd"].filter(Boolean))), key].join("-"));
  if (!media && !id) return;
  const a = media ? hitMedia(media) : findHit(a => a.type === "keys" && accordId(a.steps?.[0]) === id);
  if (!a) return;
  // Ignore the rest of a multi-step sequence so its later steps aren't read as other keys.
  const steps = a.type === "keys" ? a.steps.length : 1;
  hitQuiet = performance.now() + 150 + (steps - 1) * (num(a.delay) + 40);
  if (mods) e.preventDefault();  // e.g. ⌘S or ⌘P shouldn't open the browser's dialogs while testing
});
function findHit(match) {
  const hits = [];
  S.uploaded?.layers.forEach((l, li) => Object.entries(l.slots || {}).forEach(([n, a]) => { if (match(a)) hits.push([li, n, a]); }));
  if (!hits.length) return null;
  // The keypad's active layer is unknown: prefer the layer on screen, then the layer of the previous press.
  const rank = li => li === S.layer ? 0 : li === S.hit?.layer ? 1 : 2;
  hits.sort((x, y) => rank(x[0]) - rank(y[0]));
  showHit(hits[0][0], hits[0][1]);
  return hits[0][2];
}
const hitMedia = code => findHit(a => a.type === "media" && (CH57X.MEDIA[a.code] ?? a.code) === CH57X.MEDIA[code]);

/* ---------- toolbar actions ---------- */
$("#uploadBtn").onclick = async () => {
  if (activeRec) activeRec.stop();
  const b = $("#uploadBtn");
  S.uploading = true; b.disabled = true; b.textContent = t("up.busy");
  try {
    const r = await api("POST", "/api/upload", S.mapping);
    S.uploaded = structuredClone(S.mapping);
    toast(t("up.ok"), t("up.okSub", { hw: r.hardware, sw: r.software }), "ok");
    if (r.software && !S.agent.running) toast(t("up.agentOff"), t("up.agentOffSub"));
  } catch (e) { if (e.message !== "unauthorized" && e.name !== "NotFoundError") toast(t("up.fail"), e.message, "err"); }
  S.uploading = false; renderUpload();
  if (WEB) poll();
};
$("#devStatus").onclick = async () => {
  if (!$("#devStatus").classList.contains("link")) return;
  try { await requestKeypad(); toast(t("web.picked"), t("web.pickedSub"), "ok"); await poll(); }
  catch (e) { if (e.name !== "NotFoundError") toast(t("up.fail"), e.message, "err"); }
};
$("#exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S.mapping, null, 2) + "\n"], { type: "application/json" }));
  a.download = "macropad-mapping.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
function riskyActions(m) {
  const out = [], clip = v => String(v).replace(/\s+/g, " ").slice(0, 160);
  m.layers.forEach((l, li) => Object.entries(l.slots).forEach(([slot, a]) => {
    const where = `${li + 1}:${slot}`;
    if (a.type === "shell") out.push(`${where}  $ ${clip(a.command)}`);
    if (a.type === "open") out.push(`${where}  open ${clip(a.target)}`);
    if (a.type === "macro") for (const st of a.steps) {
      if (st.do === "shell") out.push(`${where}  $ ${clip(st.value)}`);
      if (st.do === "open") out.push(`${where}  open ${clip(st.value)}`);
    }
  }));
  return out;
}
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const m = CH57X.normalizeMapping(JSON.parse(await f.text()));
    // A shared mapping can hide commands that run as you once uploaded. Show them before accepting.
    const risky = WEB ? [] : riskyActions(m);
    if (risky.length && !confirm(t("imp.risky") + "\n\n" + risky.slice(0, 15).join("\n") + (risky.length > 15 ? `\n… (+${risky.length - 15})` : ""))) return;
    S.mapping = m;
    S.layer = 0; S.sel = "b0"; S.picking = false;
    changed(); toast(t("imp.ok"), t("imp.okSub"), "ok");
  } catch (err) { toast(t("imp.fail"), err.message, "err"); }
};
// Language switch: labelled in the language it switches to; saves any pending edit, then reloads.
const langBtn = $("#langBtn");
langBtn.textContent = LANG === "ko" ? "English" : "한국어";
langBtn.lang = LANG === "ko" ? "en" : "ko";
langBtn.onclick = async () => {
  clearTimeout(saveTimer);
  if (savePending) await savePending();
  try { localStorage.setItem(LANG_KEY, LANG === "ko" ? "en" : "ko"); } catch {}
  location.reload();
};
const menuPop = $("#menuPop");
$("#menuBtn").onclick = e => { e.stopPropagation(); menuPop.classList.toggle("open"); };
document.addEventListener("click", () => menuPop.classList.remove("open"));
$("#previewBtn").onclick = async () => {
  try {
    const r = await api("POST", "/api/preview", S.mapping);
    $("#previewPre").textContent = `# ${r.packets.length} packets × 64 bytes (trailing zeros omitted)\n\n` + r.packets.join("\n");
    $("#previewDlg").showModal();
  } catch (e) { toast(t("preview.fail"), e.message, "err"); }
};
$("#helpBtn").onclick = () => {
  $("#helpTable").innerHTML = t("help.rows").map(([k, v]) => {
    const m = k.match(/^@(dev|agt) (.*)$/);
    const head = m ? `<span class="tag"><span class="cat ${m[1]}"></span>${esc(m[2])}</span>` : esc(k);
    return `<tr><td>${head}</td><td>${esc(v)}</td></tr>`;
  }).join("");
  $("#helpDlg").showModal();
};
$("#agentToggle").onclick = async () => {
  const on = S.agent.running;
  try {
    S.agent = await api("POST", on ? "/api/agent/stop" : "/api/agent/start");
    toast(S.agent.running ? t("agent.on") : t("agent.off"), S.agent.running ? t("agent.onSub") : t("agent.offSub"), "ok");
  } catch (e) { if (e.message !== "unauthorized") toast(t("agent.fail"), e.message, "err"); }
  renderStatus(); if (cur() && !DEV.has(cur().type) && !S.picking) renderInspector();
};

/* ---------- live status ---------- */
async function poll() {
  try {
    const r = await api("GET", "/api/status");
    const was = S.agent.running;
    S.devices = r.devices; S.agent = r.agent;
    renderStatus();
    if (was !== S.agent.running && cur() && !DEV.has(cur().type) && !S.picking && !document.activeElement?.closest(".inspector")) renderInspector();
    // Only events newer than the first poll count, so an old press isn't replayed when the page opens.
    // macOS handles volume and playback keys before the page sees them; the agent reports those.
    const last = S.agent.last, media = S.agent.media, first = S.seenAt === null;
    if (first) S.seenAt = Math.max(num(last?.at), num(media?.at));
    if (!first && last && num(last.at) > S.seenAt) showHit(last.layer, last.slot);
    if (!first && media && num(media.at) > S.seenAt) hitMedia(media.code);
    if (!first) S.seenAt = Math.max(S.seenAt, num(last?.at), num(media?.at));
  } catch { S.devices = []; renderStatus(); }
}

(async function init() {
  if (WEB) {
    $("#agentToggle").style.display = "none"; $("#agentDivider").style.display = "none";
    if (!navigator.hid) { $("#banner").textContent = t("web.unsupported"); $("#banner").classList.add("on"); }
    navigator.hid?.addEventListener("connect", poll);
    navigator.hid?.addEventListener("disconnect", poll);
  }
  renderStatus();
  if (!WEB && !token()) return gate();
  let st;
  try { st = await api("GET", "/api/state"); } catch (e) { if (e.message !== "unauthorized") toast(t("save.fail"), e.message, "err"); return; }
  Object.assign(S, { mapping: st.mapping, uploaded: st.uploaded, errors: st.errors, catalog: st.catalog });
  for (const l of S.mapping.layers) l.slots ??= {};
  if (st.warning) { $("#banner").textContent = st.warning; $("#banner").classList.add("on"); }
  if (!WEB) (function loop() { setTimeout(async () => { await poll(); loop(); }, document.hidden ? 3000 : 500); })();
  const dl = document.createElement("datalist"); dl.id = "keyList";
  dl.innerHTML = [...S.catalog.keys, ...S.catalog.modifiers].map(k => `<option value="${esc(k)}">`).join("");
  document.body.append(dl);
  changed({ save: false });
  await poll();
})();
