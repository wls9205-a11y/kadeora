# 카더라 STATUS.md — 세션 65 최종 (2026-04-01 09:00 KST)

## 최신 커밋 (세션 65 — 50개)
- `f9ec695` — RightPanel 인기검색어 FALLBACK 10개 확장
- `c115317` — 바이럴 CTA 전면 확장 (리포트/피드/RightPanel)
- `1c75bf6` — 바이럴 인프라 대폭 강화 — 공유 시스템 v2
- `f10f424` — 데일리 리포트 지수/환율 섹션 + 인기검색어 10개
- `fb168a0` — kd-btn-ghost/kd-btn-danger CSS 버그 수정
- `85639c4` — 접속중 가짜→실제 데이터(RPC)
- `4d97492` — 주식 지수 KPI 4→6열 + 글로벌 지표 확장
- `7ae6a81` — 유료 상품 전면 비공개
- `bf3c757` — 올인원 상점 /shop + /premium→/shop
- `ce6d9ee` — 프로 ₩24,900 DB + plan-limits.ts + UpgradeModal
- `1802500` — 어드민 섹션 펄스 4패널 + GOD MODE 자동재시도
- `3cb3cc2` — 주식 시세 3대 버그 수정
- `1ebdc43` — 토스 유입 퍼널 풀스택

## 세션 65 전체 성과

### 바이럴 인프라 (완성)
- ShareButtons v2: 카카오/밴드/X/페이스북/링크복사 + UTM + 공유횟수
- 블로그/주식/부동산/피드/리포트/토론 — 전 페이지 공유 CTA
- RightPanel 초대 미니 배너
- 공유 포인트 1일 1회 +5P / 초대 양방향 +50P

### 주식 시세 강화
- 지수 KPI 4→6열 (KOSPI/KOSDAQ/S&P500/NASDAQ/환율/금)
- 글로벌 지표 pill 7개 (다우/원유/국채/TQQQ/SOXL/러셀)
- 시세 3대 버그 수정 (지수값/등락률/시간외)

### 데일리 리포트
- 신규 '지수 & 환율' 섹션 + 등락률 + 환율 요약
- 공유 CTA 추가

### 유료 상품 (비공개)
- 프로 ₩24,900/월 · ₩249,000/년 DB+코드+상점
- 전면 비공개 (토스 키 발급 전)

### 버그 수정 (7건)
- LiveActivityIndicator 가짜→실제 RPC
- kd-btn-ghost/kd-btn-danger CSS 미정의 (12곳)
- sync-complex-profiles RPC 타임아웃 (30→7일)
- blog-publish-queue UUID→BIGINT
- KOSDAQ 비정상 등락률 리셋
- sync RPC date 타입 에러
- 시간외 가격 오염 방지

### 기타
- 인기검색어 5→10개 + FALLBACK 10개
- 버튼 674개 전수조사 / 모바일 반응형 전수조사
- 수치 최신화 (22,600편/1,700종목)
- GuestNudge v2 / 어드민 대시보드 강화

## 데이터 현황
| 항목 | 수치 |
|------|------|
| 블로그 | 22,659편 |
| 유저 | 127명 |
| 주식 | 1,735 활성 |
| 청약 | 2,695건 |
| UV(24h) | 1,631 |
| DB | ~1,446 MB |
| 크론 | 91개 |
| 페이지 | 41개 |
| API | 192개 |
| 컴포넌트 | 88개 |

## PENDING (수동 작업)
- [ ] Anthropic 크레딧 충전 (최우선)
- [ ] 토스페이먼츠 API 키 → 유료 상품 공개
- [ ] KIS_APP_KEY 발급
- [ ] 통신판매업 신고
- [ ] Google/Naver 수동 URL 제출

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선
