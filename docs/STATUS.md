# 카더라 STATUS.md — 세션 65 최종 (2026-04-01 05:30 KST)

## 최신 커밋
- `9fb7f87` — RightPanel CTA 중복 통합 (2→1) + 결제 feature_flags
- `1802500` — 어드민 섹션 펄스 4패널 + GOD MODE 자동재시도 + 타임아웃 수정
- `21f6c5c` — GuestNudge v2 (세션 카운트+맥락 CTA 조율+전환 추적) + sync RPC 수정
- `7b0e869` — 통합 GuestNudge (6개→1개 CTA 통합)
- `5d85142` — 어드민 시세 건강도·앱인토스 패널 + GOD MODE 6크론 추가
- `c19dbb8` — 공식 SDK 빌드 복원 (npx ait build)
- `3cb3cc2` — 주식 시세 3대 버그 수정 (지수·해외 등락률·시간외 가격)
- `1ebdc43` — 토스 앱인토스 → 카더라 유입 퍼널 풀스택

## 세션 65 성과 요약

### 앱인토스 v8 제출 완료
- 콘솔: apps-in-toss.toss.im/workspace/29349/mini-app/23948
- 빌드: `cd appintoss-build && npm install && npx ait build`
- 상태: 검토 요청 완료 (2026-04-01)

### 주식 시세 3대 버그 수정
- KOSPI 2,584→5,052 / KOSDAQ 843→1,052 (네이버 증권 일치)
- 해외 등락률 CLAMP ±30% (174%→0 리셋)
- 시간외 가격 오염 방지 (isAfterHours 가드)

### 통합 GuestNudge v2 (비로그인 유도)
- 기존 6개 CTA → 1개 단계적 넛지
- 1~4일: 없음 / 5~7일: 토스트 / 8~10일: 배너 / 11일~: 모달
- SEO 보호: 블로그·부동산·주식 상세 = 토스트만
- 맥락 CTA 조율 + 전환 추적

### 어드민 대시보드 대폭 강화
- 섹션 펄스 4패널 (피드/블로그/주식/부동산 7일 추이)
- 시세 건강도 + 앱인토스 현황 패널
- GOD MODE: 타임아웃 수정 (30→120s) + 자동 재시도 + 91크론
- RPC 4개 생성 + sync_complex_profiles date 버그 수정

### 토스 유입 퍼널 풀스택
- TossTeaser (4 variant) + BlogTossGate (30%) + TossBottomBanner
- 페이지별 제한: 피드 5개, 주식 10종목, 청약 5건

### 기타
- RightPanel CTA 2→1 통합
- 결제 feature_flags 3개 추가 (payment_enabled, premium_signup, shop_enabled)
- 전수조사: SEO(robots/sitemap/OG/JSON-LD) 이상 없음, 크론 37개 정상

## 데이터 현황
| 항목 | 수치 |
|------|------|
| 블로그 | 22,659편 (미발행 0) |
| 커뮤니티 | 4,600글 / 2,781댓글 / 35토론 |
| 유저 | 127명 |
| 주식 | 1,735 활성 (0%: 107건 → 크론 자동 해소) |
| 청약 | 2,695건 (100% 파싱) |
| SEO 사이트 | 5,526개 (이미지 2,218) |
| 단지 프로필 | 34,500개 |
| 거래 | 매매 496,987 + 전월세 2,102,126 |
| DB | ~1,446 MB |
| 크론 | 91개 (GOD MODE) |

## PENDING
- [ ] Anthropic 크레딧 충전 (AI 블로그 5크론 실패 중)
- [ ] KIS_APP_KEY 발급 (실시간 시세)
- [ ] 토스페이먼츠 API 키 발급 + Vercel env 설정
- [ ] 통신판매업 신고
- [ ] 앱인토스 v8 검토 결과 대기

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile/CommentWithProfile 보호 8. daily_create_limit 80 9. DB트리거 HOURLY/DAILY_LIMIT 80 10. Supabase RPC: try/catch 11. STATUS.md 업데이트 필수 12. 디자인 토큰 우선
