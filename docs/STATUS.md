# 카더라 STATUS.md — 세션 65 최최종 (2026-04-01 08:00 KST)

## 최신 커밋 (세션 65 — 42개)
- `f10f424` — 데일리 리포트 지수/환율 섹션 + 인기검색어 10개 + 수치 갱신
- `fb168a0` — kd-btn-ghost/kd-btn-danger CSS 미정의 버그 수정
- `85639c4` — 접속중 가짜→실제 데이터(RPC) + 어드민 프로 라벨
- `4d97492` — 주식 지수 KPI 4→6열 + 글로벌 지표 확장
- `7ae6a81` — 유료 상품 전면 비공개
- `bf3c757` — 올인원 상점 /shop + /premium→/shop
- `ce6d9ee` — 프로 ₩24,900 DB + plan-limits.ts + UpgradeModal
- `1802500` — 어드민 섹션 펄스 4패널 + GOD MODE 자동재시도
- `21f6c5c` — GuestNudge v2 + sync RPC 수정
- `3cb3cc2` — 주식 시세 3대 버그 수정
- `1ebdc43` — 토스 유입 퍼널 풀스택

## 이번 세션 전체 성과

### 데일리 리포트 강화
- 신규 '📊 지수 & 환율' 섹션: KOSPI/KOSDAQ/S&P500/NASDAQ + USD/KRW
- 글로벌 마켓에 등락률 표시 추가
- 시장 요약 텍스트에 환율 + 등락률 반영
- 데이터 소스: stock_quotes 지수 + exchange_rate_history

### 인기검색어 5개→10개
- RightPanel: slice(0,5) → slice(0,10)

### 전체 수치 최신화
- guide: 블로그 20,800→22,600편 / 주식 728→1,700종목
- 랜딩 FAQ: 20,000편→22,600편
- SignupCTA: 22,600+ 블로그 / 5,500+ 분양 / 1,700+ 종목

### 주식 시세 강화
- KOSPI/KOSDAQ 지수 정상화 + 등락률 CLAMP
- 지수 KPI 4→6열 (KOSPI/KOSDAQ/S&P500/NASDAQ/USD·KRW/금)
- 글로벌 지표 pill 7개 (다우/원유/국채/TQQQ/SOXL/러셀)

### 버그 수정 (4건)
- LiveActivityIndicator 가짜 접속자→실제 RPC
- kd-btn-ghost/kd-btn-danger CSS 미정의 (12곳 영향)
- sync_complex_profiles RPC date 타입 에러
- KOSDAQ 비정상 등락률 리셋

### 유료 상품 (비공개)
- 프로 ₩24,900/월 DB + plan-limits + UpgradeModal + /shop
- 전면 비공개 ({false && + noindex + Navigation 제거)

### 기타
- GuestNudge v2: 6→1개 CTA 통합, 단계적 넛지
- 어드민 대시보드: 섹션 펄스 4패널 + GOD MODE 자동재시도
- 버튼 674개 전수조사 완료

## 데이터 현황
| 항목 | 수치 |
|------|------|
| 블로그 | 22,659편 |
| 커뮤니티 | 4,600글 / 2,781댓글 |
| 유저 | 127명 |
| 주식 | 1,735 활성 |
| 청약 | 2,695건 |
| 단지 프로필 | 34,500개 |
| DB | ~1,446 MB |
| 크론 | 91개 |

## PENDING
- [ ] Anthropic 크레딧 충전 (최우선)
- [ ] 토스페이먼츠 API 키 → 유료 상품 공개
- [ ] KIS_APP_KEY 발급
- [ ] 통신판매업 신고

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선
