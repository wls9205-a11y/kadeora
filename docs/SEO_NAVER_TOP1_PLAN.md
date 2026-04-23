# Naver 1위 SEO — 90일 KPI (세션 146 착수)

## 전략 요약
Yeti 크롤 2,174회/1,501 path 중 실제 노출 141 path (9.4% 변환) → C-Rank 권위 신호 + D.I.A. 콘텐츠 품질 동시 공략. 34,418 단지 + 1,846 종목 카탈로그 살려서 long-tail 진입 확장.

## 4대 지표 (Baseline → 90일 목표)

| 지표 | Baseline (2026-04-23) | 30일 | 60일 | 90일 |
|---|---|---|---|---|
| 네이버 통합검색 유입 (일) | 블로그 12% | +50% | +150% | +300% |
| Yeti 노출 path 수 | 141 / 1,501 (9.4%) | 400 | 900 | 1,500 |
| JSON-LD 보유 ratio | 1.2% | 30% | 60% | 90% |
| FAQ schema ratio | 0% | 4.5% (349/7.7K) | 15% | 25% |
| CWV LCP p75 (모바일) | 미측정 | 측정 시작 | < 3.0s | < 2.5s |

## Phase별 실행 체크리스트

### Phase 1 (완료 / 세션 146)
- [x] 측정 인프라: gsc_search_analytics, naver_sc_daily, web_vitals, backlink_sources, blog_batch_jobs
- [x] 봇 분류: page_views.bot_type + classifyBot lib
- [x] JSON-LD 10종 라이브러리 (Organization, WebSite, BlogPosting, FAQPage, Breadcrumb, Residence, RealEstateListing, FinancialProduct, AggregateRating, ImageObject)
- [x] CWV 수집: VitalsReporter + /api/web-vitals
- [x] FAQ 349편 백필 (목표 6,000 미달 — 원본 콘텐츠 한계)
- [x] blog-inject-images 크론
- [x] apt-image-crawl MIN_IMG_COUNT 3→4, 거래수 정렬
- [x] 얇은 콘텐츠 13편 noindex
- [x] Batch API: meta desc msgbatch_01KZUo2e8fMY26cC1nP7KbAF (403건), title msgbatch_01BZ8FoApDTnzd1N4b8NBrSm (151건)
- [x] programmatic_seo_queue 소비 크론 + /guide/[region]/[keyword] 라우트

### Phase 2 (30일 내 / 다음 세션)
- [ ] Batch API 결과 poll + 적용 (meta desc, title)
- [ ] 단지 narrative_text 배치 제출 (scripts/batch-apt-narrative.mjs)
- [ ] 네이버 스마트플레이스 등록 (docs/NAVER_PLACE_REGISTRATION.md)
- [ ] 네이버 블로그 개설 + OAuth 연동 → scripts/naver-blog-sync.mjs 자동화
- [ ] 네이버 서치어드바이저 수동 동기화 (docs/NAVER_SC_SETUP.md)
- [ ] GSC OAuth refresh_token 실재 존재 확인 + gsc-sync 첫 run 검증
- [ ] CWV 1주일 데이터 수집 후 p75 baseline 산출
- [ ] Kakao Local API 403 해결 (docs/ISSUES/kakao-geocode-403.md)

### Phase 3 (60일 내)
- [ ] 단지백과 고유 서사 10,000 단지 생성 완료
- [ ] 내부링크 그래프 재구성 (narrative_text 기반 5-링크 자동 삽입)
- [ ] 네이버 블로그 주 2회 요약 포스팅 자동화 가동
- [ ] C-Rank 권위 신호 점검 (blog, 플레이스, 검색광고 연동)
- [ ] 구조화 데이터 Google Rich Results 통과 블로그 포스트 6,000+

### Phase 4 (90일 내)
- [ ] programmatic SEO /guide/[region]/[keyword] 161건 full render + Naver SC 제출
- [ ] CWV LCP < 2.5s 달성 (이미지 lazy, HTML 캐시, 상위 가치 폰트 preload)
- [ ] 네이버 통합검색 "청약 일정", "실거래", "아파트 시세" 1페이지 진입

## 모니터링

### 일 1회 자동 측정
- `gsc_search_analytics` — GSC API 일 1회 적재
- `web_vitals` — 실제 방문자 CWV 실시간
- `page_views.bot_type` — Yeti/Googlebot 크롤 로그

### 주 1회 수동 점검
- 네이버 통합검색 "카더라" 브랜드 쿼리 → SERP 스냅샷
- 네이버 서치어드바이저 HTML 대시보드 CSV 내려받기 → `naver_sc_daily` 적재
- Google Rich Results 테스트: 샘플 블로그 3건 + 샘플 단지 2건

### 월 1회 리뷰
- 4대 지표 Baseline 대비 증감 비교
- 회귀 있을 때 원인 분석 (Yeti UA 차단, CSP 변경, 크롤 예산 등)
- 다음 30일 액션 조정

## 리스크

- Naver API 공식 미제공 → 자동화 한계, 수동 CSV 의존 (Phase 1 docs/NAVER_SC_SETUP.md 참고)
- Kakao Local 403 → Geocoding 막힘, satellite 커버리지 확장 블록 (docs/ISSUES/kakao-geocode-403.md)
- Vercel Pro 크론 100 한도 도달 → 신규 크론은 pg_cron 필수 (세션 145 교훈)
- Batch API 비용 집계 미설정 → Anthropic Console 으로 월 비용 수동 확인 필요
