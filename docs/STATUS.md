# 카더라 STATUS.md — 세션 65 최종 (2026-04-01 07:30 KST)

## 최신 커밋 (세션 65 — 40개)
- `fb168a0` — kd-btn-ghost/kd-btn-danger CSS 미정의 버그 수정
- `85639c4` — 접속중 가짜→실제 데이터(RPC) + 어드민 프로 라벨
- `4d97492` — 주식 지수 KPI 4→6열 + 글로벌 지표 확장
- `7ae6a81` — 유료 상품 전면 비공개
- `bf3c757` — 올인원 상점 /shop + /premium→/shop
- `ce6d9ee` — 프로 ₩24,900 DB + plan-limits.ts + UpgradeModal
- `9fb7f87` — RightPanel CTA 2→1 + feature_flags
- `1802500` — 어드민 섹션 펄스 4패널 + GOD MODE 자동재시도
- `21f6c5c` — GuestNudge v2 세션 카운트 + 맥락 CTA 조율
- `7b0e869` — 통합 GuestNudge (6→1 CTA)
- `3cb3cc2` — 주식 시세 3대 버그 수정
- `1ebdc43` — 토스 유입 퍼널 풀스택

## 세션 65 주요 성과

### 주식 시세
- KOSPI/KOSDAQ 지수값 정상화
- 해외 등락률 CLAMP ±30%
- 시간외 가격 오염 방지
- 지수 KPI 4→6열 (KOSPI/KOSDAQ/S&P500/NASDAQ/USD·KRW/금)
- 글로벌 지표 pill 7개 (다우/원유/국채/TQQQ/SOXL/러셀)

### 유료 상품 (비공개 상태)
- 프로 ₩24,900/월 · ₩249,000/년 · 14일 체험
- plans 4개 + usage_limits + shop_products 정리
- plan-limits.ts + UpgradeModal.tsx + 올인원 상점 /shop
- 전면 비공개 ({false && + noindex + Navigation 제거)

### 회원가입 유도
- GuestNudge v2: 6→1개 CTA 통합, 단계적 넛지
- 맥락 CTA 조율 + 전환 추적
- RightPanel CTA 2→1 통합

### 어드민 대시보드
- 섹션 펄스 4패널 (피드/블로그/주식/부동산)
- GOD MODE 120s 타임아웃 + 자동 재시도
- 프리미엄→프로 라벨 통일

### 버그 수정
- LiveActivityIndicator 가짜 접속자→실제 RPC
- sync_complex_profiles RPC date 타입 에러
- kd-btn-ghost/kd-btn-danger CSS 미정의
- KOSDAQ 비정상 등락률 리셋

### 기타
- 앱인토스 v8 제출
- 토스 유입 퍼널 풀스택
- feature_flags 5개 (payment/premium/shop/consultant)

## 데이터 현황
| 항목 | 수치 |
|------|------|
| 블로그 | 22,659편 |
| 커뮤니티 | 4,600글 / 2,781댓글 |
| 유저 | 127명 |
| 주식 | 1,735 활성 |
| 청약 | 2,695건 |
| 단지 프로필 | 34,500개 |
| 거래 | 매매 496,987 + 전월세 2,102,126 |
| DB | ~1,446 MB |
| 크론 | 91개 |

## PENDING
- [ ] Anthropic 크레딧 충전 (AI 블로그 5크론 실패 중)
- [ ] 토스페이먼츠 API 키 → 유료 상품 공개
- [ ] KIS_APP_KEY 발급
- [ ] 통신판매업 신고
- [ ] 앱인토스 v8 검토 대기

## 유료 상품 공개 체크리스트 (토스 키 후)
1. Navigation에 상점 메뉴 복원
2. {false && 블록 제거 (블로그/주식/부동산 CTA)
3. shop/page.tsx robots noindex 제거
4. sitemap에 /shop 복원
5. guide 페이지 프로 멤버십 설명 복원
6. 구독 API + 결제 플로우 E2E 구현

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선
