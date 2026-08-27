# H5-D3 — `@layer` 도입과 `!important` 전수 조사 (2026-08-27)

---

## 1. ⚠️ 지시서의 레이어 이름 3개는 «쓸 수 없다» — Tailwind v3.4 가 가로챈다

지시서: `@layer reset, tokens, base, components, screens, utilities;`

`base` · `components` · `utilities` 는 Tailwind 의 «자기 지시자» 이름과 정확히 겹친다.
postcss 로 직접 돌려 실측했다(2026-08-27, tailwindcss 3.4.19):

| 파일 | 결과 |
|---|---|
| `@tailwind` 가 **있는** 파일에 `@layer base { .x {} }` | Tailwind 가 삼킨다. 네이티브 레이어가 **출력에 안 남고** 내용이 `@tailwind base` 자리로 옮겨진다 |
| `@tailwind` 가 **없는** 파일에 `@layer components { .x {} }` | **빌드 실패** — ``@layer components` is used but no matching `@tailwind components` directive is present.`` |
| `@layer reset / tokens / screens` (예약어 아님) | 양쪽 다 네이티브 `@layer` 로 **그대로 출력됨** ✅ |

`components.css` · `blog.css` · `responsive.css` 는 `@tailwind` 가 없다. 즉 지시서대로
쓰면 **첫 빌드에서 죽는다.** 그래서 겹치는 셋만 개명했다.

```
base → elements · components → patterns · utilities → overrides
```

최종: `@layer reset, tokens, elements, patterns, screens, overrides;`

### 매핑

| 레이어 | 내용 |
|---|---|
| reset | `@tailwind base`(preflight) · `apt-tabs.css` · globals 리셋 |
| tokens | globals 의 **최상위** `:root` / `html.font-*` 순수 토큰 블록 10개 |
| elements | globals 나머지 (`@media` 안의 토큰 «덮어쓰기» 포함) |
| patterns | `@tailwind components` · `components.css` · `blog.css` |
| screens | **신설** `src/app/styles/screens.css` |
| overrides | `@tailwind utilities` · `responsive.css` |

### preflight — 끄지 않고 «가뒀다»

지시서는 「preflight 는 reset 과 중복이므로 하나만 남긴다」였다. 끄지 않았다.

레이어 밖 규칙은 **모든 레이어를 이긴다.** `@tailwind base` 를 밖에 두면 preflight 가
제목·목록·버튼 리셋으로 우리 규칙을 전부 덮는다. `@layer reset { @tailwind base; }` 로
가두면 «가장 약한 자리» 에 놓이므로, 리셋 기능은 유지하면서 중복 문제도 사라진다.
출력 CSS 에서 `border-box` 가 `@layer reset{` 안에 있는 것을 확인했다.

### ⚠️ 순서 선언문은 «파일마다» 반복한다

Next 가 CSS 를 4개 청크로 쪼갰고, 선언문은 그중 1개에만 들어갔다.
`a611822b8015ec90.css` 에는 `@layer reset{`·`@layer screens{` 만 있고 선언문이 없었다.
그 청크가 먼저 로드되면 레이어 순서가 «첫 사용 순» 으로 굳는다 — 뒤에 오는 선언문은
이미 등록된 이름의 순서를 **바꾸지 못한다.**

CSS 5파일 전부 첫 줄에 선언문을 넣었다. 반복 선언은 멱등이라 안전하다.

---

## 2. ⚠️⚠️ `!important` 는 레이어 순서가 «뒤집힌다»

일반 선언: `reset < tokens < elements < patterns < screens < overrides` (뒤가 이김)
`!important`: **`reset > tokens > elements > patterns > screens > overrides`** (앞이 이김)

즉 **globals(elements) 의 important 가 responsive(overrides) 의 important 를 이긴다.**
도입 «전» 과 정반대다. 도입 전에는 import 순서상 responsive 가 이겼다.

### 전수 조사

| 파일 | `!important` 선언 |
|---|---|
| globals.css | 158 |
| responsive.css | 71 (셀렉터 44개) |
| components.css | 5 |
| blog.css | 1 |

교차 파일에서 «셀렉터·속성이 완전히 같은» 충돌만 실제 위험이다. 스크립트로 뽑았다.

| 충돌 | 판정 |
|---|---|
| `.feed-detail-content` `font-size`/`line-height` | ⚠️ **실제 위험** — 아래 ① |
| `.kd-card` `padding` | ⚠️ **실제 위험** — 아래 ② |
| `.mc-g2` `grid-template-columns` | 무해 — 양쪽 값이 `1fr` 로 같다 |

`(components·blog) ∩ responsive` = 0쌍, `globals ∩ (components·blog)` = 0쌍.

특이도가 다른 «같은 요소» 충돌도 봤다. globals 의 `[style*="font-size: Npx"]`
인라인 스케일링 63건이 responsive 의 클래스 규칙과 같은 특이도(0,1,0)로 겨룰 수 있다.
후보 6개 클래스(`.kd-action-btn` `.blog-content` `.kd-input` `.stock-price-text`
`.feed-detail-content` `.kd-card`)가 실제로 인라인 `fontSize` 를 함께 다는지 JSX 에서 셌다.
`.kd-input` 7곳이 나왔으나 **전부 `var(--fs-*)`** 라 `[style*="font-size: Npx"]` 에
매칭되지 않는다. → **충돌 없음.**

### 도입 전에 고친 것

**① `.feed-detail-content` — 죽은 중복이 «되살아날» 뻔했다**

```
globals    @media(max-width:640px) .feed-detail-content { font-size:14.5px !important; line-height:1.75 !important }
responsive @media(max-width:640px) .feed-detail-content { font-size:var(--fs-base) !important; line-height:1.85 !important }
```

같은 미디어쿼리·같은 셀렉터·같은 속성이다. import 순서로 responsive 가 이겨서
globals 쪽은 **한 번도 이긴 적이 없는 죽은 코드**였다. 레이어를 씌우면 뒤집혀서
모바일 본문이 18px → 14.5px 로 «조용히» 작아진다. → globals 쪽 삭제.

**② `.kd-card` `padding` — 두 파일에 갈려 있었다**

```
globals    @media(max-width:767px) .kd-card { padding: 12px 14px !important }
responsive @media(max-width:480px) .kd-card { padding: var(--space-md) !important }
```

480px 이하에서 둘 다 매칭되고 responsive 가 이기고 있었다. 뒤집히면 패딩이 바뀐다.
→ 480px 규칙을 **globals 의 767px 규칙 바로 아래로 이관**했다. 한 파일 안이면
레이어가 아니라 «소스 순서» 가 결정하므로 도입 전후가 같다.

### 남은 위험

세 번째 그룹(`.mc-g2`)은 값이 같아 두지만, **`@media` 문맥까지 대조하는 자동 검사는
아직 없다.** 실화면 5장 육안 확인이 필요하다 — 지시서 §6 의 중단점이 그 자리다.

---

## 3. 롤백

`@layer` 선언 한 줄과 각 파일의 래핑만 걷으면 원상복구된다. **토큰 값은 안 바뀐다.**
단 ①②의 중복 정리는 별개 수정이라 남겨도 무방하다(둘 다 «지금 이기고 있는 쪽» 을 남겼다).

---

## 4. responsive.css `!important` 전수 (셀렉터 44 / 선언 71)

| 셀렉터 | 속성 | 비고 |
|---|---|---|
| `.admin-detail-grid` | grid-template-columns |  |
| `.admin-main` | max-width, padding |  |
| `.admin-mobile-bar` | display |  |
| `.admin-sidebar` | padding-top, position, width |  |
| `.admin-sidebar-overlay` | display |  |
| `.blog-content` | font-size, line-height, word-break |  |
| `.blog-content h2` | font-size, margin |  |
| `.blog-content h3` | font-size, margin |  |
| `.blog-content img` | border-radius |  |
| `.blog-content th, .blog-content td` | font-size, padding |  |
| `.feed-detail-content` | font-size, line-height, word-break | ⚠️ globals 와 동일 |
| `.kd-action-btn` | font-size, padding |  |
| `.kd-card` | margin-bottom |  |
| `.kd-card img` | border-radius |  |
| `.kd-feed-card` | border-radius |  |
| `.kd-input` | border-radius, font-size, padding |  |
| `.kd-interaction-bar` | gap |  |
| `.kd-interaction-bar > *` | flex, justify-content, padding |  |
| `.mc-g2` | grid-template-columns | ⚠️ globals 와 동일 |
| `.mc-g3` | grid-template-columns |  |
| `.mc-g4` | grid-template-columns |  |
| `.mc-g6` | grid-template-columns |  |
| `.mc-g6 > div, .mc-g4 > div` | padding |  |
| `.mc-hour-grid` | grid-template-columns |  |
| `.stock-krw-text` | display |  |
| `.stock-price-text` | font-size |  |
| `.stock-sparkline` | display |  |
| `.stock-symbol-code` | display |  |
| `.toss-mode body` | background, color |  |
| `.toss-mode footer` | display |  |
| `.toss-mode main` | min-height, padding-bottom |  |
| `html.font-large .apt-card, html.font-large .kd-card` | padding |  |
| `html.font-large .bottom-sheet` | padding |  |
| `html.font-large .kd-interaction-bar` | gap |  |
| `html.font-large .kd-interaction-bar button, html.font-larg` | font-size, padding |  |
| `html.font-large nav[style*="fixed"] span` | font-size |  |
| `html.font-small .apt-card, html.font-small .kd-card` | padding |  |
| `input, textarea, select` | font-size |  |
| `input, textarea, select, [contenteditable]` | font-size |  |
| `main, [role="main"]` | padding-bottom |  |
| `nav[aria-label="breadcrumb"]` | gap |  |
| `nav[class*="md:hidden"] a[aria-current="page"] span` | font-weight |  |
| `select.kd-input, input.kd-input` | box-sizing, max-width, width |  |
| `textarea.kd-input` | min-height |  |
