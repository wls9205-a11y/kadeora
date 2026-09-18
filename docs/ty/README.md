# TY3 — 타이포그래피 전수 정합 (docs/ty)

정본 지시서: FINAL_TYFB_20260918 v3.0(동결) + 판정 증분-1(통합 브랜치·한방 배포). 아래 **판정 증분-2** 는 집행 중 실측으로 생긴 증분이다(동결 본문 무수정).

## 파일

| 파일 | 무엇 | 누가 만드나 |
|---|---|---|
| `census_20260918.json` | 정적 census (인라인 7속성·테일윈드·CSS·간격 건수) | `tools/ty-audit/static-census.ts` |
| `dom-census_<label>.json` | 10화면(+toss 1) × 3뷰포트 computed 요약 — 관측 지표 | `tools/ty-audit/dom-census.ts` |
| `mapping_20260918.md` | 매핑표 — 손으로 쓰지 않는다 | `tools/ty-audit/mapping.ts` |
| `exempt-paths.json` | 예외 원장(경로) — api·og·satori·이메일 | 수기(판정 근거 기재) |
| `prop-allowlist.json` | (나)형 prop 좌표 — 값 스냅만, 게이트 예외 | codemod |
| `fs13-holdouts.json` | 13px 안전판에 걸려 리터럴 존치한 좌표 | 수기(안전판 판정) |
| `ledger.json` | display(34px 초과·clamp·제목대 대역 밖) · 자간 0 스냅 · 단위 행간 · 크기 불명 자간 | codemod |
| `bench_20260918.md` | 경쟁사 벤치 수치 요약 — 참고 지위, 어떤 기본값도 비의존 | TY-2 |

게이트: `scripts/type-audit.ts` (CI quality 잡). 계기(자)는 `tools/ty-audit/` — 게이트가 아니다.

## 판정 증분-2 (2026-09-18 · CC 실측)

1. **렌더 기준 스냅.** `globals.css` 의 세션70+s5 가드 `[style*="font-size:Npx"]{…!important}` 가 미디어 무관으로 인라인 9~15px 를
   끌어올린다(9→12 · 10→13 · 11·12→14 · 13→15 · 14·15→16). `.text-xs` 도 14px 로 고정돼 있었다. 명목값으로 스냅하면
   인라인 12px(현 렌더 14)가 모바일 11px 로 −3 떨어진다. 그래서 **현재 렌더값 → 최근접 --fs 단(동률 아래)** 으로 고른다.
   결과: 13px→`--fs-xs` 귀속은 v3.0 과 같고, 12·11px 도 `--fs-xs`, 10·9px 는 `--fs-2xs`.
2. **T4-0 브리지 xs 키 = `--fs-xs`**(v3.0 은 `--fs-2xs`). 같은 이유 — text-xs 는 가드가 14px 로 렌더하고 있었다. 가드 21줄은 T4-0 에서 퇴역.
   임의값 `text-[Npx]` 는 브리지 키가 아니라 `text-[length:var(--fs-*)]` 로 — 브리지 키는 행간 튜플을 싣고 온다.
3. **제목대 대역 규칙.** 22px 이상에서 최근접 단이 2px 넘게 떨어지면(28px = 24·32 양쪽 4px) 스냅하지 않고 display 대장 존치.
   §4 T4-0 의 «±2px 대역 이탈 키는 되돌리고 보고» 를 스냅 규칙에서 미리 지킨 것. 34px 초과(에러·빈 상태 이모지)도 같은 대장.
4. **T4-7b 신설.** 메인 4화면(/ · /apt · /blog · /stock)이 아닌 라우트(/calc · /discuss · /profile · /stock 서브 …)는
   §2 큐에 명시 묶음이 없었다. T4-7 뒤에 T4-7b 로 둔다.
5. **FB 매트릭스 5항 재판정.** `/feed` 는 `/apt` 로 영구 301(피드 표면 폐쇄)이라 «피드 목록 상단 글쓰기» 는 도달 불가 —
   원 의도 «작성 진입점 ≠ 0» 으로 잰다(`e2e/fab-openchat.spec.ts` 주석).
6. **`/daily/busan` 은 404.** 지역 slug 는 한글이다 — dom-census 는 `/daily/부산`.
7. **DS2 소관 제외.** 색·배지·tone·스테이지 칩은 §0 접촉 금지 — codemod 가 함수명(chip·badge·tone·stage)을 품은 스타일 헬퍼 몸통과
   파일명이 badge·chip·tone 인 모듈(`subscription-badge.ts` 등)을 건너뛴다. 그 안의 크기·굵기는 DS2 트랙이 정리한다(게이트도 같은 판정).
8. **자간은 치환 «후» 크기로 판정.** 인라인 13px(가드 렌더 15)는 `--fs-xs`(14)가 되므로 음수 자간은 0 — «12~13px 음수 금지» 와 일치.
9. **CSS 모바일 블록은 모바일 사다리로 스냅.** `max-width<768` 안의 값을 데스크탑 기준으로 고르면 모바일 본문이 −2 떨어진다(blog.css p 15px).
10. **input·textarea·select** 의 인라인 크기는 `max(16px, var(--fs-*))` — 모바일 사다리(sm 15)가 iOS 16px 하한을 깨지 않게.

## 되돌리기 한 줄 (Node 몫 ②)

- 렌더 기준 → 명목 기준: `tools/ty-audit/codemod.ts` 의 `renderOf` 를 항등으로. (권장하지 않음 — 위 1 참조)
- 행간 4단 재배열: `shared.ts` `LH_STEPS`. 브리지 매핑: `tailwind.config.ts` `theme.extend.fontSize`.

## 종결 (2026-09-18 · TY-5)

| 지표 | before | after |
|---|---|---|
| 화면계 인라인 fontSize px 리터럴 | 2,331 | 108 (가형 90 = display 대장 + DS2 헬퍼 · 나형 18 = prop-allowlist) |
| 그 고유 px 종수 | 30 | 14 (전부 대장 좌표) |
| `var(--fs-*)` 참조 | 1,536 | 3,697 |
| 화면계 fontWeight 800+ | 47 | 1 (`components/ds/Badge.tsx` — DS2 소관 제외) |
| 테일윈드 `text-[Npx]` | 20 | 0 |
| 화면별 고유 조합(combos) — 데스크탑 | home 27 · apt 48 · apt-id 87 · complex 51 · daily 29 · blog 39 · blog-slug 84 · stock 42 · stock-symbol 44 · search 25 | 24 · 41 · 62 · 39 · 20 · 31 · 54 · 36 · 31 · 21 |
| 화면별 고유 크기 — 데스크탑 | 10 · 13 · 11 · 10 · 7 · 13 · 16 · 11 · 7 · 6 | 7 · 8 · 8 · 8 · 6 · 6 · 12 · 6 · 7 · 5 |

게이트 `scripts/type-audit.ts` 전수 ①0 ②0 ③0 — 초록으로 태어나 CI quality 잡에 등재(RULES#151).
13px 안전판: T4-0 ~ T4-8 전 구간 신규 넘침·줄바꿈 0 → `fs13-holdouts.json` 0건.

### 넘기는 것 (DS2 트랙)

- **인라인 가드 존속** (대장: `DS2_HANDOFF.md` — 가드 44줄 + 리터럴 26건 한 몸, 동반 회수). globals.css `[style*="font-size:Npx"]{…!important}` 44줄은 아직 «사문» 이 아니다 — DS2 소관으로 건너뛴
  칩·배지·스테이지 헬퍼에 9~16px 리터럴 26건이 남아 가드가 그들을 끌어올리고 있다(`census_20260918_after.json`).
  DS2 가 그 26건을 토큰으로 옮기면 가드 44줄을 통째로 걷는다(본체 font-large-guard 는 존속).
- `components/ds/Badge.tsx` 의 `fontWeight: 800` 1건 · 헬퍼 안 행간 1.35/1.4.

### 사각 (정적 자로만 판정)

- `/daily` 본문 — 게스트는 공유 잠금 화면만 본다. `/admin` — 307→/login. `/stock` — 장중 시세로 노드 키 대조율 ~73%.

## 사고 기록 — FB 선행 유출 (2026-09-18)

- **현상:** `git push -u origin feat/tyfb-20260918` 가 `feat/tyfb-20260918 -> main` 으로 나가 FB 2커밋(21794e76·a9eb6a08)이 프로덕션 배포. TY 유출 0. 사후 7/7 로 유지 승인.
- **원인(설정 프로브 실측):** 래퍼·alias·훅·`remote.origin.push` 전부 없음(git 2.53.0.windows.2, `/mingw64/bin/git`). 유일 변수는 공유
  `.git/config` 의 **`push.default=upstream`**(세션 B `ds→main` 용). 메커니즘 실명: **dst 없는 refspec(`git push origin X`)은
  `push.default=upstream` 아래서 `branch.X.merge` 를 목적지로 채운다** — `git worktree add -b X … origin/main` 이 `branch.X.merge=refs/heads/main`
  을 자동 설정(branch.autoSetupMerge 기본값)했으므로 X→main. 샌드박스 재현: 맨 `git push`·`git push origin X`(현재 브랜치가 X 가 아니어도,
  `-u` 무관) → `X -> main` / `push.default=simple` 이면 `X -> X` / 콜론 refspec `X:refs/heads/X` 는 설정과 무관하게 `X -> X`.
- **재발 방지:** origin/main 에서 딸 때 `--no-track`, push 는 항상 콜론 refspec(`X:refs/heads/X`, main 은 `HEAD:refs/heads/main`), push 전 `git branch -vv`.
