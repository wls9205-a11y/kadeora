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
7. **input·textarea·select** 의 인라인 크기는 `max(16px, var(--fs-*))` — 모바일 사다리(sm 15)가 iOS 16px 하한을 깨지 않게.

## 되돌리기 한 줄 (Node 몫 ②)

- 렌더 기준 → 명목 기준: `tools/ty-audit/codemod.ts` 의 `renderOf` 를 항등으로. (권장하지 않음 — 위 1 참조)
- 행간 4단 재배열: `shared.ts` `LH_STEPS`. 브리지 매핑: `tailwind.config.ts` `theme.extend.fontSize`.
