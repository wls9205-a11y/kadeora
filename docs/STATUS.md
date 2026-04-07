# 카더라 STATUS.md
> 세션 79 | 2026-04-08

## 세션 79 완료

### 1. 통계 자료실 정상화
- 6개 다운로드 API 테이블명 수정 (subscription_sites→apt_subscriptions, unsold_apartments→unsold_apts, naver_complexes→apt_sites, stock_symbols→stock_quotes)
- apt/data 페이지 KPI·지역별 건수 정상 연결
- 주식 다운로드 카드 2종 추가, 중복 /api/data-export 삭제

### 2. 블로그 크론 v2 전면 재설계

**삭제 12개 (-1,856줄):**
blog-afternoon, blog-daily, blog-monthly, blog-weekly, blog-apt-cluster, blog-stock-cluster, blog-apt-new, blog-redevelopment, blog-monthly-theme, blog-seed-comments, blog-monthly-topics, blog-seed-guide

**ensureMinLength 완전 제거 (22개 크론):**
카테고리별 동일 보일러플레이트(600~700자) 삽입 방지 → 스팸 리스크 해소

**신규 크론 2개:**
- blog-market-pulse: 주간 시장 브리핑 (stock_quotes+exchange_rates+unsold_apts)
- blog-weekly-digest: 주간 종합 뉴스레터 (인기글+시장+청약일정)

**볼륨 제한:**
- trade-trend: default limit 17→1 (1지역/run)
- competition-rate: default limit 17→1 (1지역/run)
- 일 평균 발행: 1.7건 (구글/네이버 안전 범위)

**패딩 제거 도구:** blog-cleanup-padding 크론 생성 (어드민에서 수동 실행)

### 3. 어드민 갱신
- 블로그 크론 버튼 전면 교체 (삭제 크론 제거, v2 크론 20개 배치)
- 패딩 제거 버튼 추가

### 블로그 크론 스케줄 (v2 최종)

| 요일 | 크론 | 카테고리 |
|------|------|---------|
| 월 | blog-market-pulse, blog-trade-trend | stock, apt |
| 화 | blog-investor-flow, blog-competition-rate | stock, apt |
| 수 | blog-district-guide | apt |
| 목 | blog-builder-analysis, blog-theme-stocks | apt, stock |
| 금 | blog-unsold-trend, blog-disclosure | unsold, stock |
| 토 | blog-comparison, blog-life-guide | apt, finance |
| 일 | blog-weekly-digest | all |
| 월1일 | blog-exchange-rate | finance |
| 수,토 | blog-apt-v2 (AI) | apt |
| 화,금 | blog-stock-v2 (AI) | stock |
| 4h | blog-rewrite (AI) | all |

### 리라이트 현황
- blog-rewrite: 4시간마다 6건 (Haiku)
- batch-rewrite-submit: 일 500건 (Batch API)
- batch-rewrite-poll: 10분마다 결과 수집
- Anthropic 크레딧: ✅ 정상
- 리라이트 완료: ~17,800편 / 미완료: ~41,200편 / 예상 완료: ~2.5주

### 현재 수치
- 블로그 크론: 파일 33개 / 활성 20개
- 총 블로그: ~59,000편 (공개 ~21,000)
- 총 크론: 79개 (vercel.json)
- 검색 노출: 43,700/월, CTR 0.6%, 평균순위 7.7

### API 키 상태
- ANTHROPIC_API_KEY: ✅ (크레딧 정상)
- CRON_SECRET: ✅
- STOCK_DATA_API_KEY: ✅
- KIS_APP_KEY: ❌
- FINNHUB_API_KEY: ❌
- APT_DATA_API_KEY: ❌

### 다음 작업
- [ ] 어드민에서 패딩 제거 버튼 실행 (기존 글 보일러플레이트 일괄 제거)
- [ ] 리라이트 진행률 모니터링
- [ ] Phase 2 크론 활성화 검토 (redev-summary, subscription-calendar 등)
- [ ] 전국 종합 1편 리팩토링 (trade-trend/competition-rate)

## 세션 79 추가 — 주식 페이지 Phase 1 강화

### 종목 상세 (/stock/[symbol]) 강화
- 52주 가격 바: 조건부→항상 표시 + "상위 N%" 위치 표시
- 동종업종 비교: 5개→10개 + PER/PBR/배당 데이터 추가
- SectionShareButton 3곳 추가 (종목요약, AI분석, 섹터비교)
- 수급 데이터: 5일→20일
- 차트 데이터: 60일→365일
- 차트 기간 탭: +6개월, +1년

### 인프라 정리
- ghost cron 제거: stock-refresh (라우트 파일 없음, 404 반환)
- 실패 크론 제거: apt-crawl-pricing, apt-backfill-details (APT_DATA_API_KEY 미설정)
- Vercel 크론: 79→76개 (한도 100개 확인 — 안전)

### 버그 수정
- stock/data: stock_symbols → stock_quotes 테이블명 수정

### 다음 작업 (Phase 2)
- [ ] /stock/search — 종목 검색 전용 페이지
- [ ] /stock/dividend — 배당주 TOP 30
- [ ] /stock/movers — 급등락 + 52주 신고가/신저가
- [ ] /stock/themes — 테마주 독립 페이지
- [ ] /stock/market/[code] — 시장별 페이지

### 주식 Phase 2 — 신규 하위 페이지 5개
- /stock/dividend: 고배당주 TOP 30 (국내/해외, 배당수익률순)
- /stock/movers: 급등락 TOP 20 + 거래량 TOP 20 + 52주 신고가/신저가
- /stock/themes: 테마주 독립 페이지 (테마별 관련주 + 평균 등락률)
- /stock/market/[code]: KOSPI/KOSDAQ/NYSE/NASDAQ 시장별 종목 목록 (4페이지)
- /stock/search: 종목 검색 + 시장/섹터/시총/정렬 필터
- Sitemap: 신규 8개 URL 추가

주식 라우트: 6개→11개 (부동산 12개에 근접)
