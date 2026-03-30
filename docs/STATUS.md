# 카더라 STATUS.md — 세션 58 최종 (2026-03-30 10:30 KST)

## 최신 커밋
- `05bcae3` — 이미지 사이트맵에 단지백과 1,000개 OG 이미지 추가
- `1bdd197` — 상세 페이지 onError 서버 컴포넌트 에러 제거
- `e134f62` — 상세 페이지 ImageGallery JSON-LD + 이미지 그리드 + 현장 링크
- `8ea6542` — sync-complex-profiles SQL 함수 전환 + 좌표 90% 커버
- `ca44877` — 단지백과 레이아웃 대폭 압축 (스크롤 70% 감소) + 카드 정보 강화
- `c14ba73` — 단지백과 지역별 필터 연동 (?region= 서버 필터링)
- `12d79ed` — 어드민 단지백과 KPI 패널 + 레이아웃 재배치
- `886a7b5` — SEO 대폭 강화 (geo/JSON-LD/OG/naver:author)
- `7e2b149` — 사이트맵 34,495개 단지 추가 (5~7)
- `d36c90c` — 단지백과 검색 기능 + trigram GIN
- `add062c` — /apt 타임아웃 수정 (fetchAllRows 49만건 제거)

## 단지백과 SEO 풀스택 현황 (10/10)
- ✅ JSON-LD Place + GeoCoordinates (30,982개 좌표)
- ✅ JSON-LD Dataset (실거래 데이터셋)
- ✅ JSON-LD BreadcrumbList (5단계)
- ✅ JSON-LD FAQPage (4Q 상세 / 3Q 메인)
- ✅ JSON-LD ImageGallery (apt_sites 이미지 연결)
- ✅ geo.position / ICBM / geo.placename (30,982개)
- ✅ OG 1200x630 + 630x630 네이버 모바일
- ✅ naver:author / article:published_time / modified_time
- ✅ DB 기반 seo_title / seo_description (34,495개)
- ✅ 이미지 사이트맵 (1,000개 × 2 = 2,000 이미지)

## 데이터 현황 (라이브)
- ✅ 단지 프로필: 34,495개 (좌표 30,982 / SEO 34,495 / 매매 26,807 / 전세 26,592)
- ✅ 매매 실거래: 496,987건
- ✅ 전월세 실거래: 2,095,019건
- ✅ 블로그: 20,857편
- ✅ apt_sites: 5,512개 (이미지 654 / 좌표 645)
- ✅ 주식: 728종목
- ✅ 유저: 121명 / DB: ~1.4 GB / 크론: 88개
- ✅ 사이트맵: ~55,000+ URL / 이미지 7,172개

## 속도 최적화
- blog 검색: 164ms → 1.77ms (93배)
- /apt 타임아웃: 해소 (fetchAllRows 제거)
- sync-complex-profiles: JS 200K limit → SQL 함수 (전체 250만건)
- DB 인덱스: 427 → 364개 (63개 삭제 + 8개 추가)
- Materialized View 2개 + VACUUM ANALYZE

## PENDING
- [ ] Anthropic 크레딧 충전 (블로그 AI 크론 중단)
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 재제출

## 아키텍처 규칙 (11개)
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
