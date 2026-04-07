# 카더라 STATUS.md
> 세션 79 | 2026-04-08

## 세션 79 완료 — 블로그 크론 시스템 v2 전면 재설계

### 통계 자료실 정상화 (커밋 4f7eec50)
- 6개 다운로드 API 테이블명 전면 수정 (subscription_sites→apt_subscriptions 등)
- KPI 카드·지역별 건수 정상 연결
- 주식 다운로드 카드 2종 추가 (전종목시세, 섹터별분석)
- 중복 /api/data-export 삭제

### SEO 기술 수정 26건 (커밋 11fb9cb3~c51f9739)
- userScalable:true, @type 배열→단일, robots.txt 정리
- naver:written_time 22파일 동적화, title suffix 제거 8파일
- FAQPage JSON-LD, COOP 충돌 해소, CSS @import→link 등

### Phase 1 성장 인프라 (커밋 c51f9739)
- /api/cron/seo-title-optimize 크론 추가
- /about/team E-E-A-T 페이지, /press 프레스 킷
- /apt/data 다운로드 섹션 + sitemap 등록

### 블로그 크론 시스템 v2 재설계 (커밋 35288d1b)

**삭제 12개 크론 (-1,856줄):**
- 씬 콘텐츠: blog-afternoon, blog-daily, blog-monthly, blog-weekly
- 기능 중복: blog-apt-cluster, blog-stock-cluster, blog-apt-new, blog-redevelopment, blog-monthly-theme
- 불필요: blog-seed-comments, blog-monthly-topics, blog-seed-guide

**ensureMinLength 완전 제거 (22개 크론):**
- 동일 보일러플레이트(600~700자) 삽입 방지 → 스팸 리스크 해소

**신규 크론 2개:**
- blog-market-pulse: 주간 시장 종합 브리핑 (stock_quotes + exchange_rates + unsold_apts)
- blog-weekly-digest: 주간 종합 뉴스레터 (인기글 + 시장 + 청약 일정)

**스케줄 재배치:**
- 일일 발행: 23건(위험) → 1.7건(안전)
- trade-trend: 17지역/run → 1지역/run
- competition-rate: 17지역/run → 1지역/run
- DB전용 11개 크론 활성화 (AI 비용 0)

**어드민 갱신:**
- 블로그 크론 버튼 전면 교체 (삭제 크론 제거, 신규 크론 추가)
- 패딩 제거 버튼 추가 (blog-cleanup-padding)

### vercel.json 크론 배치 (v2 최종)

**블로그 콘텐츠 크론 (13개):**
| 크론 | 요일 | 카테고리 |
|------|------|---------|
| blog-market-pulse | 월 18:00 | stock/market |
| blog-trade-trend | 월 14:00 | apt/trade |
| blog-investor-flow | 화 16:00 | stock/analysis |
| blog-competition-rate | 화 10:00 | apt/competition |
| blog-exchange-rate | 매월 1일 | finance/invest |
| blog-district-guide | 수 06:00 | apt/guide |
| blog-builder-analysis | 목 07:00 | apt/guide |
| blog-theme-stocks | 목 10:00 | stock/theme |
| blog-unsold-trend | 금 11:00 | unsold/trend |
| blog-disclosure | 금 12:00 | stock/analysis |
| blog-life-guide | 토 07:00 | finance |
| blog-comparison | 토 09:00 | apt/guide |
| blog-weekly-digest | 일 08:00 | stock/weekly |

**AI 크론 (3개, 크레딧 필요):**
- blog-apt-v2: 수,토 08:00
- blog-stock-v2: 화,금 10:00
- blog-rewrite: 4시간마다

**유틸리티 (4개):**
- blog-publish-queue, blog-quality-prune, blog-internal-links, blog-series-assign

### 스팸 안전 수치
- 일 평균 발행: 1.7건 (구글 안전: <3, 네이버 안전: <2)
- ensureMinLength 패딩: 완전 제거
- 템플릿 중복: limit=1로 제한
- 최소 본문: 실데이터 2,000자 이상 시에만 발행

### 다음 작업
- [ ] Anthropic API 크레딧 $200 충전 (console.anthropic.com)
- [ ] 어드민에서 패딩 제거 버튼 실행 (blog-cleanup-padding)
- [ ] Phase 2 크론 활성화 검토 (DA 15+ 달성 시)
- [ ] 전국 종합 1편 리팩토링 (trade-trend/competition-rate)
- [ ] GSC 인덱싱 모니터링

### 현재 상태
- 블로그 크론: 파일 33개 / 활성 20개
- 총 블로그: ~21,000편
- 총 크론: ~79개 (vercel.json)
- DA: 5~8 (추정)
- 검색 노출: 43,700/월
- AI 크레딧: ❌ 소진

### 주요 API 키 상태
- ANTHROPIC_API_KEY: ✅ (크레딧 소진 — 충전 필요)
- CRON_SECRET: ✅
- STOCK_DATA_API_KEY: ✅
- KIS_APP_KEY: ❌
- FINNHUB_API_KEY: ❌
- APT_DATA_API_KEY: ❌
