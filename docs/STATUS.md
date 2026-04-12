# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-13 03:50 KST (세션 92)

## 세션 92 — 부동산 SEO 대규모 확장 (PHASE 1+2 배포)

### 완료 — PHASE 1: 프로그래매틱 SEO 기반 구축
- **시군구 허브 페이지**: `/apt/area/[region]/[sigungu]` 신규 (260개 시군구, 10개+ 단지 noindex)
  - KPI 4종, 연차별 분포, 매매가/거래량 TOP 10, 동별 링크, FAQ 8개
  - JSON-LD 4종 (BreadcrumbList, FAQPage, Dataset, Article+Speakable)
  - 유니크 분석 문단 (데이터 기반, 템플릿 아님)
- **동 허브 페이지**: `/apt/area/[region]/[sigungu]/[dong]` 신규 (2,852개 동, 5개+ 단지 noindex)
  - KPI 3종, 단지 목록, FAQ 3개, JSON-LD 2종
- **robots.txt 정적 전환**: 동적 라우트 → public/robots.txt
- **단지백과 사이트맵 image 태그**: sitemap id=5~7에 `<image:image>` 추가
- **시군구/동 허브 사이트맵**: sitemap id=21 추가 (안티스팸 임계값 적용)
- **내부 링크 강화**: apt/[id] + complex/[name] → 시군구/동 허브 pill 링크
- **llms.txt 강화**: URL 패턴 명시, 데이터 수치 갱신, 핵심 부동산 데이터 추가

### 완료 — PHASE 2: 비교 페이지 + 데이터 보강
- **단지 비교 페이지**: `/apt/compare/[slugs]` 신규 (A-vs-B URL 패턴)
  - 12개 비교 항목 테이블, FAQ 3개, 유니크 분석 문단
  - complex/[name]에 "비교하기" CTA 추가 (같은 시군구 상위 단지)
- **price_change_1y 대량 채우기**: 2,291 → **13,460건** (39% 커버리지, 6배 증가)
  - apt_transactions 기반 자동 계산 (최근 6개월 vs 12~18개월 전)

### 스팸 리스크 방지 조치 (7중 안전장치)
1. 시군구 10개 / 동 5개 단지 미만 → `robots: noindex` + `notFound()` 이중 차단
2. 비교 페이지: 두 단지 모두 데이터 필수, 없으면 noindex
3. 모든 페이지 데이터 기반 유니크 분석 문단 (템플릿 텍스트 아님)
4. canonical URL 전량 설정
5. JSON-LD 구조화 데이터 (FAQ + BreadcrumbList + Dataset + Article)
6. 사이트맵 안티스팸 임계값 동일 적용
7. 공공데이터 출처 명시 (국토교통부 실거래가 공개시스템)

### 예상 인덱스 페이지 수 증가
- 시군구 허브: ~200+ 페이지
- 동 허브: ~1,500+ 페이지
- 비교 페이지: on-demand ISR (내부 링크 통해 점진적 생성)
- 합계: 기존 ~42,000 → ~44,000+ 페이지 (비교 페이지 제외)

### DB 변경
- `apt_complex_profiles.price_change_1y`: 2,291 → 13,460건 UPDATE

### 다음 단계 (PHASE 3 예정)
- 가격대별 조합 페이지 (시군구 × 가격 티어)
- 연차별 조합 페이지 (시군구 × 연차)
- 건설사 브랜드 페이지
- 테마 페이지 (역세권, 학군, 전세가율 TOP/BOTTOM 등)
- 월간 자동 리포트 크론
- price_change_1y 자동 갱신 크론 생성
- total_households KAPT API 확장 (현재 55건)
- 리뷰/평점 시스템 활성화 → AggregateRating 스키마
