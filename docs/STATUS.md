# 카더라 STATUS.md — 세션 65 최종 (2026-04-01 04:50 KST)

## 최신 커밋
- `c19dbb8` — **공식 SDK 빌드 복원 (npx ait build)**
- `3cb3cc2` — 주식 시세 3대 버그 수정 (지수·해외 등락률·시간외 가격)
- `1ebdc43` — 토스 앱인토스 → 카더라 유입 퍼널 풀스택 구현
- `27a854b` — 크론 파서 공유 모듈 리팩터 (412→55줄)
- `9eda529` — 앱인토스 v7 빌드 — 반려 3건 수정 + 5탭 + 피드 API v2
- `e9a75e4` — KOSPI/KOSDAQ 지수 크론 자동 갱신
- `d9cc4d2` — 모집공고 파서 대폭 강화 (+30필드)

## 주요 성과

### 앱인토스 v8 제출 완료
- **콘솔**: apps-in-toss.toss.im/workspace/29349/mini-app/23948
- **빌드**: `npx ait build` → kadeora.ait (3.5MB, deploymentId UUID 자동)
- **SDK**: 2.4.0, `devDependencies: {}` 필수 (Object.keys 에러 방지)
- **빌드 방법**: `cd appintoss-build && npm install && npx ait build`
- **기능 5개**: 실시간 주식 시세, 청약·부동산, 투자 블로그, 커뮤니티 피드, 통합 검색
- **상태**: 검토 요청 완료 (2026-04-01)

### 토스 → 카더라 유입 퍼널 (풀스택)
- **전략**: 앱인토스는 토스 3,000만 유저 풀에서 유입 채널 — 맛보기만 보여주고 본앱 유도
- **TossTeaser.tsx**: 재사용 CTA (4가지 variant: card/inline/banner/gate)
- **BlogTossGate.tsx**: 블로그 본문 30% truncate + CTA
- **TossBottomBanner.tsx**: 하단 고정 배너 (페이지별 맞춤 메시지)
- **toss-mode.ts v3**: openInBrowser() — TossApp.openExternal → window.open 폴백
- **페이지별 제한**: 피드 5개, 주식 10종목, 청약 5건, 블로그 30%

### 주식 시세 3대 버그 수정
1. **KOSPI 지수**: 2,584 → 5,052 (네이버 증권 일치)
2. **KOSDAQ 지수**: 843 → 1,052
3. **해외 등락률**: Lam Research +174% 등 수십 건 → CLAMP ±30% 적용
4. **시간외 가격 오염**: isAfterHours 가드 (15:35 KST 이후 국내 스킵)
- 크론 스케줄: stock-naver-sync `*/10 0-6` UTC (KST 9~15시만)

### 모집공고 파서 대폭 강화 (+30 필드)
- 건물스펙: total_households/total_dong_count/max_floor/min_floor/parking_total+ratio/heating_type/structure_type/exterior_finish
- 면적: land_area/building_area/floor_area_ratio/building_coverage
- 금융: balcony_extension+cost/loan_available/loan_rate(유이자·무이자 구분)
- 세대분류: supply_breakdown (주택형별 전용면적·세대수·공급가 배열)

### 어드민 업데이트
- **시세 건강도 패널**: KOSPI/KOSDAQ 지수값, 등락률 0% 건수, 비정상(>30%) 건수
- **앱인토스 현황 패널**: v8 검토 요청, SDK 2.4.0, 퍼널 5페이지 제한
- **GOD MODE**: 6개 크론 추가 (batch-pdf-parse, stock-naver-sync, indexnow-mass, premium-expire, refresh-mv, daily-report-snapshot)

## 데이터 현황
| 항목 | 수치 |
|------|------|
| 블로그 | **22,659편** (미발행 0) |
| 커뮤니티 | 4,598글 / 2,774댓글 / 35토론 |
| 유저 | 127명 |
| 주식 | 1,735 활성 (지수 2 포함) |
| 청약 | 2,694건 (100% 파싱) |
| DB | ~1,415 MB |
| 크론 | 90개 (GOD MODE 91) |

## PENDING
- [ ] 해외 시세 0% 잔여 297건 → 다음 크론 실행 시 자동 처리
- [ ] 이미지 수집 25%→100% (collect-site-images)
- [ ] 카카오 지도 SDK — Vercel 캐시 없이 Redeploy
- [ ] Anthropic 크레딧 충전 (console.anthropic.com)
- [ ] KIS_APP_KEY 발급 (apiportal.koreainvestment.com)
- [ ] FINNHUB_API_KEY 발급 (finnhub.io)
- [ ] 통신판매업 신고 후 푸터 번호 추가
- [ ] 앱인토스 검토 결과 대기 (v8)

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile/CommentWithProfile 보호 8. daily_create_limit 80 9. DB트리거 HOURLY/DAILY_LIMIT 80 10. Supabase RPC: try/catch 11. STATUS.md 업데이트 필수 12. 디자인 토큰 우선 (하드코딩 px 금지)
