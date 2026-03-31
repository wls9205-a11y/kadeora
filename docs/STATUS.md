# 카더라 STATUS.md — 세션 65 최종 (2026-04-01 07:00 KST)

## 최신 커밋
- `4d97492` — 주식 지수 KPI 4열→6열 강화 + 글로벌 지표 확장
- `7ae6a81` — 유료 상품 전면 비공개 (토스 키 발급 전까지)
- `dc2dc47` — STATUS.md 유료 상품 구현 현황 반영
- `bf3c757` — 올인원 상점 페이지 + /premium→/shop 통합
- `ce6d9ee` — 프로 ₩24,900 DB + plan-limits.ts + UpgradeModal
- `9fb7f87` — RightPanel CTA 통합 + feature_flags
- `1802500` — 어드민 섹션 펄스 4패널 + GOD MODE 자동재시도
- `21f6c5c` — GuestNudge v2 + sync RPC 수정
- `7b0e869` — 통합 GuestNudge (6→1 CTA)
- `3cb3cc2` — 주식 시세 3대 버그 수정
- `1ebdc43` — 토스 유입 퍼널 풀스택

## 세션 65 성과 (13개 커밋)

### 주식 시세 3대 버그 수정
- KOSPI 2,584→5,052 / KOSDAQ 843→1,052
- 해외 등락률 CLAMP ±30%, 시간외 가격 오염 방지

### 주식 페이지 강화
- 지수 KPI: 4열→6열 (KOSPI/KOSDAQ/S&P500/NASDAQ/USD·KRW/금)
- 글로벌 지표 pill: 다우/원유/국채/TQQQ/SOXL/러셀 (7개)
- 모바일 3×2 / 데스크탑 6열 반응형

### 통합 GuestNudge v2
- 6개 CTA → 1개 단계적 넛지 (1~4일 없음 / 5~7일 토스트 / 8~10일 배너 / 11일+ 모달)
- 맥락 CTA 조율 + 전환 추적 + SEO 보호

### 어드민 대시보드 대폭 강화
- 섹션 펄스 4패널 (피드/블로그/주식/부동산)
- GOD MODE: 타임아웃 120s + 자동 재시도 + 91크론

### 유료 상품 ₩24,900 프로 멤버십
- DB: plans 4개 + usage_limits + shop_products 정리
- 코드: plan-limits.ts + UpgradeModal.tsx + 올인원 상점 /shop
- 현재: **전면 비공개** (토스 키 발급 전까지)
- 복원: {false && 제거 + Navigation 상점 복원 + noindex 제거

### 기타
- 앱인토스 v8 제출 완료
- 토스 유입 퍼널 풀스택
- RightPanel CTA 2→1 통합
- sync_complex_profiles RPC 수정 (8회 실패 해결)

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
- [ ] Anthropic 크레딧 충전 (최우선)
- [ ] 토스페이먼츠 API 키 → 유료 상품 공개
- [ ] KIS_APP_KEY 발급
- [ ] 통신판매업 신고
- [ ] 앱인토스 v8 검토 대기

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선
