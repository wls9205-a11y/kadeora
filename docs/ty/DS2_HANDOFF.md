# DS2 이관 대장 — 인라인 font-size 가드 44줄 + DS2 소관 리터럴 (TY3 · 2026-09-18)

> **한 몸이다.** globals.css `@layer elements` 의 `[style*="font-size:Npx"]{…!important}` 가드 44줄(ROOT·font-large·font-small)은
> TY3 이후 아래 리터럴 26건만 끌어올리고 있다. DS2 잔여 재개 시 **리터럴을 --fs-* 로 옮기는 커밋에서 가드 44줄을 동반 회수**한다.
> 한쪽만 하면 안 된다 — 리터럴만 옮기면 가드는 유령 규칙이 되고, 가드만 걷으면 칩·배지가 9~16px 명목값으로 줄어든다(9→12·10→13·11·12→14·13→15·14·15→16 이 사라진다).

판정 근거: TY3 codemod 가 §0 «색·배지·tone·스테이지 칩 접촉 금지» 로 건너뛴 자리(docs/ty/README.md 판정 증분-2 ⑦). 게이트 type-audit 도 같은 판정이라 이 자리는 게이트 밖이다.

## 가드가 아직 붙잡고 있는 리터럴 (26)

| 좌표 | 값 |
|---|---|
| `src/app/admin/apt-stage/StageInputClient.tsx:55` | 13 |
| `src/app/admin/apt-stage/StageInputClient.tsx:189` | 12 |
| `src/app/admin/apt-stage/StageInputClient.tsx:200` | 13 |
| `src/app/admin/apt-stage/StageInputClient.tsx:227` | 14 |
| `src/app/admin/apt-stage/StageInputClient.tsx:230` | 11 |
| `src/app/admin/apt-stage/StageInputClient.tsx:275` | 12 |
| `src/app/admin/apt-stage/StageInputClient.tsx:277` | 12 |
| `src/app/admin/apt-stage/StageInputClient.tsx:299` | 14 |
| `src/app/admin/apt-stage/StageInputClient.tsx:302` | 11 |
| `src/app/admin/apt-stage/StageInputClient.tsx:368` | 11 |
| `src/app/admin/apt-stage/StageInputClient.tsx:375` | 13 |
| `src/app/admin/apt-stage/StageInputClient.tsx:392` | 15 |
| `src/app/admin/marketing/kakao/_components/SegmentBuilder.tsx:288` | 11 |
| `src/app/admin/v4/components/PipelineStages.tsx:61` | 10 |
| `src/app/admin/v4/components/PipelineStages.tsx:64` | 12 |
| `src/app/admin/v4/sections/SignupFunnelWidget.tsx:334` | 10 |
| `src/app/admin/v4/sections/WatchlistWidget.tsx:513` | 10 |
| `src/components/apt/LifecycleTimeline.tsx:95` | 11 |
| `src/components/AptImageGallery.tsx:25` | 11 |
| `src/components/cards/v2/TierBadge.tsx:23` | 10 |
| `src/components/ds/Badge.tsx:58` | '9.5px' |
| `src/components/RegulationBadges.tsx:90` | 11 |
| `src/components/RegulationBadges.tsx:95` | 13 |
| `src/components/RegulationBadges.tsx:105` | 11 |
| `src/lib/apt/subscription-badge.ts:34` | 11 |
| `src/lib/apt/subscription-badge.ts:76` | 11 |

## 같은 자리의 굵기 800+ (1)

| 좌표 | 값 |
|---|---|
| `src/components/ds/Badge.tsx:61` | 800 |

## 회수 절차

1. 위 리터럴을 렌더 기준 스냅(docs/ty/mapping_20260918.md §1)으로 --fs-* 치환 — codemod 는 `inDs2Helper`·파일명 제외를 풀고 대상 파일만 돌린다.
2. 같은 커밋에서 globals.css 가드 44줄 삭제(font-large-guard 본체는 존속).
3. `npx tsx tools/ty-audit/static-census.ts` 로 화면계 인라인 px(9~16) 0 확인 → dom-census 안전판 → type-audit.
