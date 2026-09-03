# 규칙 원장 대사표 — 2026-09-03 (G-4 ①)

목적: 원장이 셋(`docs/RULES.md` · `docs/ARCHITECTURE_RULES.md` · `docs/DS_RULES.md`)이고 번호 대역이 겹쳐, 같은 번호가 다른 규칙을 가리키거나(동번호 이의) 어디에도 없는 번호가 코드에서 인용되는(유령) 상태다. 이 표가 통합 커밋(G-4 ②)의 판정 근거다.

## 0. 원장 현황 (기계 파싱, 2026-09-03)

| 원장 | 형식 | 번호 | 개수 |
|---|---|---|---|
| `docs/RULES.md` | `- **#N** 한 줄` 불릿 | #11~#105 (결번 #1~10·#12·#14·#21~#42·#65·#66·#67) | 68 |
| `docs/ARCHITECTURE_RULES.md` | `## Rule #N — 제목` + 본문(Symptom/Cause/Rule) | #11·17~25·27·28·30~34·36~43·107·115·116 | 28 |
| `docs/DS_RULES.md` | 디자인 시스템 전용 · 번호 대역 분리 | — | — |

**대역 충돌의 구조**: RULES.md 는 「이전 #1~#10, #12, #21~#42 등 예전 규칙」을 아카이브로 밀어 그 대역을 비웠는데, ARCHITECTURE_RULES.md 가 **그 폐대역(#21~#42)을 재사용**했다. 그래서 두 파일이 같은 번호를 다른 뜻으로 들고 있다.

## 1. 겹침 6번호 — 문안 대사 결과

| # | RULES.md | ARCHITECTURE_RULES.md | 판정 | 처리 |
|---|---|---|---|---|
| 11 | `docs/STATUS.md` 매 세션 prepend + commit/push 필수 | STATUS.md 갱신 (existing) | **사본** | RULES 단일 — ARCH 상세본을 RULES 로 이관 |
| 17 | 36 RLS 정책 + service_role 전용 RPC + `is_current_user_admin()` | Anthropic Batch API polling 워커는 결과를 한 번에 적용 (s205) | **이의** | ARCH 쪽을 **#117** 로 재등재 |
| 18 | vercel.json catch-all maxDuration 이 per-route export 를 silently override | **2026-08-27 정정: 캐치올은 per-route 를 «덮지 않는다»** | **동일 주제·내용 상충(후자가 정정)** | RULES#18 문안을 정정본으로 교체 |
| 19 | cron 삭제 전 3종 검증 | cron route 삭제 전 3종 검증 (s223) | **사본** | RULES 단일 |
| 20 | Kakao Marketing 5중 send guard | 광고성 메시지 발송 5중 가드 (s227) | **사본**(ARCH 가 상세본) | RULES 단일 — 상세본 이관 |
| 43 | ImageResponse 내 CSS variable 금지 — satori 미지원 | 중복 생존자를 `content_score` 로 고르지 말 것 (M2 B-4) | **이의** | ARCH 쪽을 **#118** 로 재등재 |

세션 A 가 이의로 지목했던 #21·#42 는 **RULES.md 에 규칙으로 없다** — 아카이브 헤더 문장(「이전 … #21~#42 등」) 안의 대역 표기였다. 실제 겹침은 6번호다.

## 2. 결번 #65·#66·#67 — 유령 인용의 진원

| # | 실태 | 처리 |
|---|---|---|
| 65 | 두 원장·코드·STATUS 어디에도 문안 없음(언급 0건) | **결번 확정** — 등재하지 않는다 |
| 66 | 원장에 없는데 **코드·문서 13파일이 인용**한다. 문안은 실재: 「빈·실패 응답을 캐시에 굳히지 않는다 — 비면 캐시를 건너뛰고 그 자리에서 다시 조회」(s269c 회귀 대응) | **전승 정식 등재**(신설 아님) — 번호를 그대로 살려 인용 13곳을 유효하게 만든다 |
| 67 | 원장에 없고, 두 STATUS 가 **서로 다른 규칙**을 그 번호로 부른다: `docs/STATUS.md` = Claude Code git push 표준 패턴 / 루트 `STATUS.md` = generateStaticParams 가드와 대상 배열은 같은 상수 | **동번호 이의** — #67 은 폐기 결번, 두 문안을 **#119·#120** 으로 갈라 등재 |

## 3. 인용 전수 (재번호 대상)

- **구 ARCH#43 → #118**: `src/app/(main)/page.tsx` · `src/lib/home/chips.ts` · `docs/ARCHITECTURE_RULES.md`(자체 표) · `docs/m2/B-4_재정의.md`(2곳)
- **구 ARCH#17 → #117**: `docs/STATUS.md`(s205 참조) · 루트 `STATUS.md`(W8 항목)
  ⚠️ 루트 `STATUS.md` 의 다른 자리(권한 확인 「Rule #17」)는 **RULES#17(RLS)** 을 가리킨다 — 같은 문자열이 두 규칙을 뜻하던 실례이고, 재번호 후에는 갈린다.
- **#66**: 13파일 — 번호를 살려 등재하므로 인용 수정 없음.

## 4. 발효된 인용 규율 (증분5 §3)

- 인용은 **파일 접두**: `RULES#68` · `ARCH#107` · `DS_RULES#n`. 맨 번호 단독 인용 금지.
- 신규 등재는 **RULES.md 단일**. ARCHITECTURE_RULES.md 신규 등재 동결.
- 이 표의 처리 결과는 G-4 ② 통합 커밋에 반영한다.
