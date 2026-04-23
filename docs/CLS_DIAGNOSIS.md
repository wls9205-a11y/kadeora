# CLS 진단 — 세션 150

## 현황 (2026-04-23)
| metric | device | n | p75 | p50 | poor | needs |
|---|---|---|---|---|---|---|
| CLS | desktop | 12 | **0.232** | 0.166 | 3 | 7 |
| CLS | mobile | 12 | **0.180** | 0.049 | 1 | 4 |

→ 데스크탑은 "poor" 경계, 모바일 "needs-improvement". Google/Naver 모바일 가중치 손실 중.

## 상위 CLS path TOP 10 (avg CLS 기준)

| # | path | avg CLS | 유형 |
|---|---|---|---|
| 1 | /apt/경기-고양시-미분양 | 0.329 | 지역 미분양 랜딩 |
| 2 | /blog/apt-sub-analysis-... | 0.282 | apt 청약 블로그 |
| 3 | /blog/035420-kospi-수급분석 | 0.281 | 종목 분석 블로그 |
| 4 | /blog/018290-kosdaq-목표주가 | 0.274 | 종목 블로그 |
| 5 | /apt/레이카운티 | 0.218 | apt 현장 |
| 6 | /blog/000080-kospi-주식분석 | 0.215 | 종목 블로그 |
| 7 | /apt/complex/미래엠피아 | 0.214 | 단지 |
| 8 | /apt/대구-달성군-미분양 | 0.168 | 지역 미분양 |
| 9 | /blog/010955-kospi-수급분석 | 0.168 | 종목 블로그 |
| 10 | /blog/두산위브-트리니뷰-구명역-분양-총정리 | 0.167 | apt 분양 블로그 |

## 추정 원인 (공통)
1. **블로그 인라인 OG 이미지** — H2 경계 삽입 (세션 146 B4). width/height 없이 `/api/og` URL 로 마크다운 삽입. 로드 시 height 변동.
2. **CTA 컴포넌트 비동기 마운트** — BlogAptAlertCTA, LoginGate, BlogMidGate 등 useEffect 후 렌더 → 위에서부터 콘텐츠 아래로 밀림
3. **apt 단지 차트 블록** — 거래 이력, 면적별 차트가 서버 데이터 fetch 후 DOM 삽입
4. **Webfont swap** — 한글 폰트 로드 중 FOUT → text reflow
5. **광고/알림/토스트 배너** — 초기 null, 조건부 렌더

## 수정 전략 (세션 150 작업)

### Fix 1 (B 트랙): 이미지 치수 명시
- next/image 사용처 → width/height prop 필수 확인
- `<img>` raw 사용처 → width/height 속성 추가
- `/api/og` 인라인 이미지 → markdown 에서 width/height 불가 → `<img>` HTML 로 삽입 전환 (세션 146 B4 수정)

### Fix 2 (C 트랙): 스켈레톤 치수 고정
- BlogAptAlertCTA: `min-height: 120px` 예약 (로그인 여부 결정 전)
- LoginGate / BlogMidGate: `min-height: 200px`
- apt/complex 차트/거래/면적별: 서버에서 렌더 (클라이언트 fetch 제거) 또는 skeleton fixed height

### Fix 3: font-display 전략
- `display: swap` → `display: optional` (FOIT 허용, reflow 방지)
- 또는 `size-adjust` 로 fallback 폰트와 실폰트 크기 차이 제거

### Fix 4 (D 트랙): web-vitals Attribution API
- `onCLS` 의 `attribution.largestShiftTarget` + `largestShiftValue` 서버 전송
- `web_vitals.cls_largest_shift_target` / `cls_largest_shift_value` 컬럼 신설
- 실측 원인 엘리먼트 셀렉터 누적 → 다음 세션에서 타겟 수정
