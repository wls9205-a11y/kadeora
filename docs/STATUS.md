# 카더라 STATUS.md — 세션 65 최종 (2026-04-01 06:20 KST)

## 최신 커밋
- `bf3c757` — 올인원 상점 페이지 + /premium→/shop 통합 + 가격 문구 업데이트
- `ce6d9ee` — 유료 상품 ₩24,900 프로 멤버십 DB + plan-limits.ts + UpgradeModal
- `9fb7f87` — RightPanel CTA 중복 통합 + 결제 feature_flags
- `1802500` — 어드민 섹션 펄스 4패널 + GOD MODE 자동재시도
- `21f6c5c` — GuestNudge v2 + sync RPC 수정
- `7b0e869` — 통합 GuestNudge (6개→1개 CTA)
- `5d85142` — 어드민 시세 건강도·앱인토스 패널
- `3cb3cc2` — 주식 시세 3대 버그 수정
- `1ebdc43` — 토스 유입 퍼널 풀스택

## 유료 상품 구현 현황

### 가격 확정
- 프로 월간: ₩24,900/월 (하루 ₩830)
- 프로 연간: ₩249,000/년 (₩20,750/월, 17% 할인)
- 프로 체험: ₩0 (14일 무료)

### 구현 완료
- [x] plans 테이블 4개 플랜 (free/pro_monthly/pro_yearly/pro_trial)
- [x] usage_limits 테이블 (월간 사용량 추적)
- [x] shop_products 정리 (비활성 삭제, 가격 업데이트)
- [x] feature_flags 3개 (payment_enabled, premium_signup_enabled, shop_enabled)
- [x] src/lib/plan-limits.ts (게이팅 함수)
- [x] src/components/UpgradeModal.tsx (업그레이드 모달)
- [x] 올인원 상점 /shop (프로+확성기+유틸리티)
- [x] /premium → /shop 리디렉트
- [x] 전체 링크·문구 "프리미엄"→"프로" 통일

### 미구현 (다음 세션)
- [ ] Phase 2: 구독 관리 API (/api/subscription/create, cancel, status, trial)
- [ ] Phase 3: 프로 전용 기능 (관심종목 COUNT 제한, 푸시 분기, AI 분석, CSV 내보내기, 단지 비교)
- [ ] Phase 4: 결제 플로우 E2E (토스 키 발급 후)

## 데이터 현황
| 항목 | 수치 |
|------|------|
| 블로그 | 22,659편 |
| 커뮤니티 | 4,600글 / 2,781댓글 / 35토론 |
| 유저 | 127명 |
| 주식 | 1,735 활성 |
| 청약 | 2,695건 |
| SEO 사이트 | 5,526개 |
| 단지 프로필 | 34,500개 |
| 거래 | 매매 496,987 + 전월세 2,102,126 |
| DB | ~1,446 MB |
| 크론 | 91개 (GOD MODE) |

## PENDING (수동 작업)
- [ ] Anthropic 크레딧 충전 (AI 블로그 5크론 실패 중 — 최우선)
- [ ] 토스페이먼츠 API 키 발급 + Vercel env
- [ ] KIS_APP_KEY 발급
- [ ] 통신판매업 신고

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile/CommentWithProfile 보호 8. daily_create_limit 80 9. DB트리거 HOURLY/DAILY_LIMIT 80 10. Supabase RPC: try/catch 11. STATUS.md 업데이트 필수 12. 디자인 토큰 우선
