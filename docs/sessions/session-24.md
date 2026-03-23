# 세션 24 — 카더라 10대 진화 (2026-03-23)

## 요약
10개 기능을 풀스택으로 한 세션에 구현. 기존 기능 무해한 범위에서 대규모 기능 확장.

---

## 변경 사항

### 1. 개인화 대시보드 (피드 상단)
- 로그인 유저에게 관심종목 등락률 + 관심청약 D-day + 읽지않은 알림을 위젯형으로 표시
- 접기/펼치기 토글 (localStorage 기억)
- **파일:** `src/components/PersonalDashboard.tsx`, FeedClient 수정

### 2. 가격 알림 시스템
- 주식: 목표가 도달, 등락률 초과 알림
- 부동산: 청약 D-day 알림 (D-1, D-3)
- DB: `price_alerts` 테이블 (유저당 최대 20개)
- 크론: `check-price-alerts` (평일 09~16시, 15분마다)
- **파일:** `src/app/api/alerts/route.ts`, `src/app/api/cron/check-price-alerts/route.ts`

### 3. 블로그 시리즈 시스템
- `blog_series` 테이블 + `blog_posts.series_id/series_order` 컬럼
- 시리즈 목록 페이지 `/blog/series`
- 시리즈 상세: 타임라인 스타일 목차 + JSON-LD ItemList
- 블로그 상세: 시리즈 이전/다음 네비게이션
- 블로그 목록: 📚 시리즈 탭 추가
- **파일:** `src/app/(main)/blog/series/page.tsx`, `[slug]/page.tsx`, API, blog detail 수정

### 4. 포트폴리오 시뮬레이터
- 주식 페이지에 💰 포트폴리오 탭 추가 (국내/해외 모두)
- 종목 추가 → 매수가/수량 → 현재가 대비 수익률 자동 계산
- 총 투자금액/평가금액/총 손익 요약 카드
- DB: `portfolio_holdings` 테이블 (유저당 최대 50종목)
- **파일:** `src/components/PortfolioTab.tsx`, `src/app/api/portfolio/route.ts`, StockClient 수정

### 5. 실거래가 추이 차트
- SVG 라인차트 (거래가/평당가 전환, 호버 툴팁)
- 최고/최저/평균/최근 가격 통계 카드
- 실거래 모달에 자동 렌더
- API: RPC 우선 → 직접 쿼리 폴백
- **파일:** `src/components/charts/AptPriceTrendChart.tsx`, `src/app/api/apt/price-trend/route.ts`

### 6. UGC 아파트 리뷰
- 단지별 별점 + 장단점 + 리뷰 작성 (유저당 단지 1개)
- 평균 평점, 거주중 뱃지, 리뷰 작성 시 10포인트 지급
- 실거래 모달에 자동 렌더
- **파일:** `src/components/AptReviewSection.tsx`, `src/app/api/apt/reviews/route.ts`

### 7. 지역별 SEO 랜딩 페이지
- `/apt/region/[region]` — 17개 광역시도 + 13개 주요 시군구 (30개)
- 청약/실거래/재개발/미분양 요약 카드 + 리스트 + CTA
- generateStaticParams로 빌드 시 정적 생성 → SEO 극대화
- WebPage JSON-LD
- **파일:** `src/app/(main)/apt/region/[region]/page.tsx`

### 8. 부동산 지도뷰
- `/apt/map` — 카카오맵 SDK 연동
- 청약/분양중/재개발/미분양 레이어 토글
- 주소 → 좌표 변환 (Geocoder) → 마커 + 인포윈도우
- 핀 클릭 시 하단 정보 카드
- 부동산 페이지 헤더에 🗺️ 지도 버튼 추가
- **파일:** `src/app/(main)/apt/map/page.tsx`, `MapClient.tsx`, AptClient 수정

### 9. Skeleton UI 전면 적용
- 범용 Skeleton 컴포넌트: Card/StockRow/AptCard/Chart/Dashboard/List
- shimmer 애니메이션 적용
- PersonalDashboard, PortfolioTab, AptPriceTrendChart에 적용
- **파일:** `src/components/Skeleton.tsx`

### 10. 크론 모니터링 대시보드
- 어드민 시스템 페이지에 크론 현황 테이블 추가
- 기간 선택 (6시간/24시간/3일/7일)
- 크론별: 총실행/성공/실패/평균ms/마지막실행/상태
- 실패 크론 알림 배너
- RPC `get_cron_summary` + 직접 쿼리 폴백
- **파일:** `src/components/CronDashboard.tsx`, `src/app/api/admin/cron-summary/route.ts`, admin system 수정

---

## DB 마이그레이션

**파일:** `supabase/migrations/20260323_session24_evolution.sql`

### 신규 테이블
| 테이블 | 설명 |
|--------|------|
| blog_series | 블로그 시리즈 |
| price_alerts | 가격 알림 |
| portfolio_holdings | 포트폴리오 보유 종목 |
| apt_reviews | UGC 아파트 리뷰 |

### 신규 컬럼
- blog_posts.series_id, blog_posts.series_order

### RPC
| RPC | 설명 |
|-----|------|
| update_series_count | 시리즈 포스트 카운트 갱신 |
| get_portfolio_summary | 포트폴리오 현재가 조인 |
| get_cron_summary | 크론 실행 요약 |
| get_apt_price_trend | 단지별 실거래가 추이 |
| get_region_realestate_summary | 지역별 부동산 통계 |

### 인덱스
- idx_blog_posts_series, idx_blog_series_slug
- idx_price_alerts_active, idx_price_alerts_stock
- idx_portfolio_user, idx_portfolio_unique
- idx_apt_reviews_name, idx_apt_reviews_region
- idx_cron_logs_name_time, idx_cron_logs_status

---

## 신규 파일 (21개)

```
supabase/migrations/20260323_session24_evolution.sql
src/components/Skeleton.tsx
src/components/PersonalDashboard.tsx
src/components/PortfolioTab.tsx
src/components/CronDashboard.tsx
src/components/AptReviewSection.tsx
src/components/charts/AptPriceTrendChart.tsx
src/app/api/alerts/route.ts
src/app/api/cron/check-price-alerts/route.ts
src/app/api/portfolio/route.ts
src/app/api/apt/price-trend/route.ts
src/app/api/apt/reviews/route.ts
src/app/api/blog/series/route.ts
src/app/api/admin/cron-summary/route.ts
src/app/(main)/blog/series/page.tsx
src/app/(main)/blog/series/[slug]/page.tsx
src/app/(main)/apt/region/[region]/page.tsx
src/app/(main)/apt/map/page.tsx
src/app/(main)/apt/map/MapClient.tsx
docs/sessions/session-24.md
```

## 수정 파일 (7개)

```
src/app/(main)/feed/FeedClient.tsx         — PersonalDashboard 추가 + next/Image
src/app/(main)/stock/StockClient.tsx       — 포트폴리오 탭 + visibility 폴링
src/app/(main)/apt/AptClient.tsx           — 지도 링크 + 차트 + 리뷰 + 지역 내부링크
src/app/(main)/blog/page.tsx               — 시리즈 탭 추가
src/app/(main)/blog/[slug]/page.tsx        — 시리즈 네비게이션 + 동적 OG 이미지
src/app/admin/system/page.tsx              — CronDashboard 추가
vercel.json                                — check-price-alerts 크론
```

## 품질 강화 (2차 커밋, +7개 신규 파일)

### 신규 파일
```
src/lib/env-validate.ts     — 환경변수 검증 유틸
src/lib/safe-catch.ts       — 빈 catch 대체 (Sentry 리포트)
src/lib/cron-lock.ts        — 크론 중복 실행 방지
src/lib/use-modal-a11y.ts   — 모달 접근성 훅 (Escape+포커스트랩)
src/app/api/apt/tab-data/route.ts — 탭별 경량 데이터 API
```

### 수정 파일
```
src/lib/supabase-admin.ts            — env 검증 + 싱글톤
src/app/api/portfolio/route.ts       — rate-limit + sanitize + 검증
src/app/api/alerts/route.ts          — rate-limit + 싱글톤
src/app/api/apt/reviews/route.ts     — rate-limit + sanitize + 검증
src/app/api/cron/check-price-alerts  — 싱글톤 + cron-lock 재작성
src/app/sitemap.ts                   — 지역30개 + 시리즈 + 맵
src/app/(main)/stock/[symbol]/page.tsx — 동적 OG 이미지
src/components/Toast.tsx             — aria-live 접근성
src/components/PortfolioTab.tsx      — EmptyState 통일
eslint.config.mjs                    — no-console 규칙
```

---

## 배포 전 필수

### Supabase SQL Editor 실행
```
supabase/migrations/20260323_session24_evolution.sql
```

### KAKAO_JS_KEY 환경변수 확인
부동산 지도뷰에 카카오맵 SDK 사용. `NEXT_PUBLIC_KAKAO_JS_KEY` 환경변수 필요.

---

## 다음 세션

### 즉시
- [ ] Google Search Console sitemap 재제출
- [ ] 네이버 서치어드바이저 sitemap 제출
- [ ] blog_series 초기 시리즈 데이터 시드

### 중기 (코드)
- [ ] AptClient 2045줄 탭별 분할 (5개 서브 컴포넌트)
- [ ] AptClient 탭별 lazy fetch 연결 (tab-data API 활용)
- [ ] safe-catch.ts 전면 적용 (빈 catch 65개)
- [ ] useModalA11y 모달 전면 적용
- [ ] 블로그 시리즈 시드 크론 (14,578건 자동 묶기)
- [ ] 포트폴리오 수익률 히스토리 (일일 스냅샷)
- [ ] 지도뷰 클러스터링

### 장기
- [ ] Skeleton UI 전 탭 확대 적용
- [ ] 리뷰 좋아요/신고 기능
- [ ] GSC 색인 현황/CWV 점검
