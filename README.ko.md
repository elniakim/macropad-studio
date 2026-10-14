# Macropad Studio

[English](README.md) · **한국어**

알리익스프레스나 아마존에서 파는 저렴한 **CH57x 기반 매크로 키패드**(키 12개 + 노브 2개, USB ID
`1189:8840` 및 비슷한 기종)를 설정하는 도구입니다. 제조사 소프트웨어는 Windows 전용이고, 현재 매핑을
보여 주지도 못합니다. Macropad Studio는 쓰기 편한 편집기와 키 녹화 기능을 제공합니다. 맥에서는 작은
백그라운드 에이전트를 함께 실행해서, 키패드 하드웨어만으로는 할 수 없는 일도 키에 맡길 수 있습니다.
텍스트 입력, 앱 실행, 쉘 명령 실행, 여러 단계로 된 매크로 재생이 그런 예입니다.

**[웹 앱 열기 →](https://elniakim.github.io/macropad-studio/)** 설치할 것이 없습니다. 키패드를 꽂고
Chrome이나 Edge(macOS, Windows, 리눅스, ChromeOS)에서 페이지를 연 뒤 업로드하면 됩니다.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshot-dark.png">
  <img alt="키 12개, 노브 2개 키패드에서 매크로를 편집하는 Macropad Studio" src="docs/screenshot-light.png">
</picture>

## 기능

- 레이어 3개를 모두 다루는 **시각적 편집기**: 키 12개와 노브 2개(왼쪽 회전, 누르기, 오른쪽 회전).
  키를 끌어다 놓아 서로 바꾸고, 슬롯을 복사해 붙여 넣고, 레이어마다 LED 모드와 색을 정할 수 있습니다.
- **키 녹화**: 키보드로 단축키를 누르면 그대로 기록됩니다.
- **실시간 키 확인**: 키패드의 키를 누르면 어느 슬롯이 동작했는지 편집기에 불이 들어오고 툴바에
  표시됩니다. 키 입력은 편집기 창이 앞에 있어야 하고, 에이전트 슬롯과 미디어 키(볼륨, 재생 등은
  macOS가 브라우저보다 먼저 처리합니다)는 맥 에이전트가 켜져 있을 때 표시됩니다.
- **하드웨어가 지원하는 모든 것**: 키 시퀀스, 미디어 키, 마우스 클릭·스크롤·이동·드래그, 그리고
  고급 사용자를 위한 원본 도구의 표현식 문법.
- 하드웨어로는 안 되는 일을 위한 **에이전트 액션**(아래 참고): 모든 유니코드 텍스트 입력(이모지,
  한글 등), 앱·URL·파일 열기, 쉘 명령 실행, 단계별 대기와 반복이 있는 매크로.
- 라이트/다크 모드, 영어/한국어 UI(브라우저 언어를 따르고, ··· 메뉴에서 바꿀 수 있습니다).
- 원본 도구의 YAML 형식을 읽는 CLI.

## 웹 앱과 맥 앱 중 무엇을 쓸까

| | [웹 앱](https://elniakim.github.io/macropad-studio/) | 맥 앱(이 저장소) |
|---|---|---|
| 설치 | 없음 | Python + `pip install` |
| OS | 어디서나, Chrome / Edge / 기타 크로미움 브라우저 | macOS |
| 키, 미디어, 마우스, LED, 레이어 | ✓ | ✓ |
| 텍스트, 앱/URL 열기, 쉘, 여러 단계 매크로 | — | ✓ (맥 에이전트) |
| 매핑이 저장되는 곳 | 이 브라우저(JSON으로 내보내기/가져오기) | 저장소 폴더의 `state/` |

둘은 같은 편집기와 같은 인코더를 쓰고, ··· 메뉴의 **매핑 내보내기 / 가져오기**로 매핑을 서로
옮길 수 있습니다. 웹 앱은 [WebHID](https://developer.mozilla.org/docs/Web/API/WebHID_API)로 키패드와
통신합니다. Chrome이 처음 한 번 키패드를 고르라고 묻고, 페이지는 고른 장치에만 접근할 수 있습니다.
Safari와 Firefox는 WebHID를 지원하지 않습니다.

### 리눅스: 브라우저가 키패드에 접근하도록 허용하기

리눅스에서는 root만 raw HID 장치를 열 수 있어서, udev 규칙을 추가하기 전에는 Chrome에 키패드가
보여도 쓰기가 안 됩니다. `uaccess`는 장치를 모든 계정이 쓸 수 있게 여는 대신, 지금 그 컴퓨터에
로그인한 사용자에게만 접근을 허용합니다.

```sh
sudo tee /etc/udev/rules.d/70-macropad-studio.rules >/dev/null <<'RULES'
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="1189", ATTRS{idProduct}=="8840|8842|8850", TAG+="uaccess"
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="514c", ATTRS{idProduct}=="8851", TAG+="uaccess"
RULES
sudo udevadm control --reload-rules && sudo udevadm trigger
```

그다음 키패드를 뽑았다가 다시 꽂으세요. macOS, Windows, ChromeOS는 따로 설정할 필요가 없습니다.

## 테스트한 범위

실제 하드웨어로 테스트한 것:

- 키 12개, 노브 2개인 `1189:8840` 키패드(알리익스프레스에서 흔한 모델)
- Apple silicon 맥의 macOS 26에서 맥 앱(Python 3)과 웹 앱(Chrome)
- 두 앱 모두에서 업로드한 뒤 실제로 키를 눌러 확인, 그리고 모든 에이전트 액션 종류

동작할 것으로 예상하지만 **테스트하지 않은 것**(가진 하드웨어가 아니라 원본 도구의 프로토콜 정보에
기대고 있습니다):

- 다른 ID(`1189:8842`, `1189:8850`, `514c:8851`)
- 다른 배열(키 3, 6, 15개, 노브 1, 3, 4개). 편집기는 현재 키 12개 + 노브 2개만 보여 줍니다
- Windows, 리눅스, ChromeOS에서의 웹 앱, 그리고 Edge, Brave, Arc, Opera

프로토콜이 다른 키패드(흔히 "ch57x-2"로 팔리거나, 키 3개와 노브 1개만 있는 것)는 지원하지 않습니다.
가진 기종이 동작하든 안 하든 `python macropad.py list`의 출력이나 키패드를 연결할 때 Chrome에 표시되는
이름을 적어 [이슈를 열어](https://github.com/elniakim/macropad-studio/issues) 주세요.

## 요구 사항(맥 앱)

- macOS(macOS 26, Apple silicon에서 테스트)와 Python 3.10 이상
- "ch57x-1" 프로토콜을 쓰는 키패드: `1189:8840`, `1189:8842`, `1189:8850`, `514c:8851`.
  `python macropad.py list`로 확인할 수 있습니다.

## 빠른 시작(맥 앱)

```sh
git clone https://github.com/elniakim/macropad-studio.git
cd macropad-studio
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```

`server.py`는 전용 링크(`http://127.0.0.1:8757/#token=…`)로 브라우저에서 편집기를 엽니다. 이 링크를
계속 쓰거나 북마크해 두세요. 키를 고르고 할 일을 정한 다음 **키패드에 업로드**를 누르면 1초도 걸리지
않습니다.

CLI는 원본 도구의 YAML 형식을 받습니다.

```sh
.venv/bin/python macropad.py list
.venv/bin/python macropad.py validate mapping.yaml
.venv/bin/python macropad.py upload mapping.yaml --dry-run   # USB 패킷 출력
.venv/bin/python macropad.py led 0 "backlight blue"
```

## 하드웨어로 할 수 있는 것과 없는 것

| | 한계 |
|---|---|
| 레이어 | 3개, 옆면 버튼으로 전환. 레이어마다 LED 모드가 따로 있음 |
| 슬롯 | 키 12개 + 노브 2개 × (왼쪽, 누르기, 오른쪽) = 레이어당 18개, 모두 54개 |
| 키 시퀀스 | "수정키 + 키 하나"로 된 단계를 최대 18개. 지연 시간(0–6000 ms)은 하나만 정할 수 있고 *모든* 단계 사이에 똑같이 적용 |
| 미디어 | 슬롯마다 HID Consumer 코드 하나: 볼륨, 재생, 밝기 또는 임의의 코드 |
| 마우스 | 클릭(버튼 조합 자유), 스크롤 ±127, 이동/드래그 ±127 px. 수정키는 최대 하나(control, shift, option 중 하나, command는 안 됨) |
| 불가능 | 텍스트 입력, 단계마다 다른 대기 시간, 반복, 길게 누르기와 짧게 누르기 구분, 앱 실행 |

하드웨어 액션은 키패드 안에 저장되므로 이 앱이 없어도 어느 컴퓨터에서나 동작합니다. 키패드는 현재
매핑을 알려 주지 못하기 때문에, 업로드할 때마다 54개 슬롯 전부를 다시 씁니다. 빈 슬롯도 예전 값을
남겨 두지 않고 지웁니다.

## 맥 에이전트

"불가능" 줄에 있는 일을 위해 Macropad Studio는 키패드에 **숨은 트리거 조합키**(예: ⌃⌥⇧⌘F16)를
저장하고, 작은 에이전트(`agent.py`)를 실행합니다. 에이전트는 Quartz 이벤트 탭으로 이 조합키를 잡아서
어떤 앱에도 전달되지 않게 삼킨 뒤, 원래 하려던 동작을 실행합니다.

- 툴바의 **맥 에이전트**로 켜고 끕니다. 에이전트가 꺼져 있으면 에이전트 슬롯은 아무 일도 하지 않고,
  에이전트를 실행 중인 맥에서만 동작합니다.
- 에이전트 슬롯은 최대 40개입니다(F13–F20과 수정키 3–4개 조합 다섯 가지). 이 조합키들은 예약되어
  있어서 하드웨어 키에 지정할 수 없습니다.
- 에이전트를 실행하는 앱(터미널, iTerm 등)에 **손쉬운 사용** 권한이 필요합니다:
  시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용.
- 편집기의 **테스트 실행**으로 키패드를 건드리지 않고 에이전트 액션을 시험해 볼 수 있습니다.

## 보안

### 맥 앱

편집기는 맥에서 쉘 명령을 실행하게 만들 수 있으므로, 로컬 서버를 단단히 잠가 두었습니다.

- `127.0.0.1`에서만 열리고 `Host`와 `Origin` 헤더를 확인하므로, 다른 웹사이트(그리고 DNS 리바인딩
  공격)는 접근할 수 없습니다.
- 모든 API 호출에는 `state/token`(권한 `0600`, `0700` 디렉터리 안)에 저장된 무작위 토큰이 있어야
  합니다. localhost에 닿을 수 있는 다른 사용자 계정, 샌드박스 앱, 컨테이너도 이 서버를 조작할 수
  없습니다. 토큰 파일이 비었거나 잘려 있으면 "토큰 없음"으로 취급하지 않고 새로 만듭니다.
- 쓰기 요청은 반드시 `application/json`이어야 해서 CORS 사전 요청이 일어나고, 이 요청은 절대 승인되지
  않습니다. 페이지는 프레임 안에 넣을 수 없습니다(`frame-ancestors 'none'`).
- 매핑은 저장하기 전에 엄격한 스키마로 검사하고, UI가 그리는 모든 내용은 이스케이프합니다. 요청
  본문은 4 MB로 제한합니다.
- 에이전트는 "열기" 대상을 쉘을 거치지 않고 `open`의 인자로 넘기며, 옵션으로 읽힐 수 있는 대상
  (`-`로 시작하는 것)은 거부합니다.

남는 위험은 이 기능의 목적 그 자체입니다. 매핑의 쉘 액션은 사용자 권한으로 실행됩니다. **직접 만들었거나
믿을 수 있는 매핑만 쓰세요.** 쉘 명령이나 "열기" 액션이 들어 있는 매핑을 가져오면, 그 내용을 모두
보여 주고 받아들일지 묻습니다. 에이전트는 트리거 조합키를 잡기 위해 키 입력을 보지만, 그 조합키에만
반응하고 그 조합키만 기록합니다. 그 밖에는 편집기에 보여 주려고 마지막으로 누른 미디어 키(예: "볼륨 올리기")만
남겨 둡니다.

### 웹 앱

- 백엔드가 없는 정적 페이지입니다. 매핑은 브라우저 밖으로 나가지 않고, 페이지는 컴퓨터에서 아무것도
  실행할 수 없습니다. 조작된 매핑이 할 수 있는 최악의 일은 키패드의 키를 바꾸는 것입니다.
- WebHID는 Chrome 선택 창에서 고른 장치에만 닿고, 페이지는 지원하는 키패드의 제조사 설정
  인터페이스만 요청합니다.
- 엄격한 콘텐츠 보안 정책(CSP)이 인라인 스크립트와 외부 스크립트, 다른 사이트로의 요청을 모두 막고,
  페이지는 프레임 안에서는 실행되지 않습니다.
- 배포에 쓰는 GitHub Actions는 커밋 SHA로 고정되어 있고 최소 권한으로 실행됩니다.

보안 문제는 공개 이슈 대신
[GitHub 보안 권고](https://github.com/elniakim/macropad-studio/security/advisories/new)로 비공개로
알려 주세요.

## 동작 방식

키패드는 제조사 전용 HID 인터페이스(usage page `0xFF00`, report ID 3)를 갖고 있습니다. 설정은 64바이트
리포트를 연달아 보내는 방식입니다. 슬롯마다 바인딩 리포트 하나, 짧은 커밋 시퀀스, 그리고 필요하면 LED
리포트를 보냅니다. macOS에서는 이 인터페이스를 시스템 HID 드라이버가 갖고 있어서, 이 프로젝트는
libusb 대신 **hidapi**를 쓰고 모든 hidapi 호출을 오래 살아 있는 스레드 하나에서 실행합니다(hidapi의
macOS 백엔드는 처음 불러온 스레드의 런 루프에 묶여 있습니다).

```
ui/index.html ──JSON──▶ server.py ──compile──▶ macropad.py ──hidapi──▶ keypad
                            │
                            └─ state/device.json ──▶ agent.py (Quartz event tap)
```

| 파일 | 역할 |
|---|---|
| `macropad.py` | 프로토콜 인코더, 표현식 파서, 매핑 스키마와 컴파일러, CLI |
| `server.py` | 로컬 웹 서버와 JSON API |
| `ui/index.html`, `ui/app.js` | 빌드 단계 없는 편집기. `127.0.0.1`에서는 로컬 모드, 그 밖의 주소에서는 WebHID 모드 |
| `ui/ch57x.js` | 웹 앱용으로 JavaScript에 옮긴 인코더. 테스트가 `macropad.py`와 바이트 단위로 같은지 확인 |
| `agent.py` | 트리거 조합키가 들어오면 에이전트 액션 실행 |
| `state/` | 작업 중인 매핑, 마지막으로 업로드한 매핑, API 토큰(git에서 제외) |

## 개발

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

테스트는 인코더를 원본 도구의 테스트 벡터와 바이트 단위로 비교하고, JavaScript 인코더가 Python 인코더와
정확히 같은 바이트를 만드는지 확인하며(`node` 필요), 스키마, 트리거 조합키 규칙, 에이전트의 텍스트
분할을 다룹니다. 웹 모드를 로컬에서 시험하려면 아무 정적 서버로 `ui/`를 띄우고 `index.html?web`을
여세요. `MACROPAD_STATE`와 `MACROPAD_PORT`로 별도 state 디렉터리를 쓰는 두 번째 인스턴스를 띄울 수
있습니다.

## 크레딧

키패드 프로토콜은 [kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool)(MIT)이
리버스 엔지니어링했습니다. `macropad.py`와 `ui/ch57x.js`의 인코더는 그 도구의 `ch57x-1`(k884x) 드라이버를
옮긴 것입니다. [`LICENSE`](LICENSE)를 참고하세요.

## 라이선스

[MIT](LICENSE)
