# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-13 04:20 KST (세션 92)

## 세션 92 — 부동산 SEO 대규모 확장 (PHASE 1~3 완료)

### PHASE 1: 프로그래매틱 SEO 기반 구축 ✅
- 시군구 허브 `/apt/area/[region]/[sigungu]` (260개 시군구, noindex 10개 미만)
- 동 허브 `/apt/area/[region]/[sigungu]/[dong]` (2,852개 동, noindex 5개 미만)
- robots.txt 정적 파일 전환 (동적→public/)
- 단지백과 사이트맵 image:image 태그 추가 (34,537개)
- 시군구/동 허브 전용 사이트맵 id=21
- 내부 링크: apt/[id] + complex/[name] → 허브 pill 링크
- llms.txt URL 패턴 + 핵심 데이터 수치 갱신

### PHASE 2: 비교 페이지 + 데이터 보강 ✅
- 단지 비교 `/apt/compare/[A-vs-B]` (12개 비교 항목, FAQ 3개)
- complex/[name] → "비교하기" CTA 추가
- price_change_1y: 2,291 → **13,460건** (39% 커버리지, 6배 증가)

### PHASE 3: 테마 페이지 + 자동 크론 ✅
- 테마 페이지 `/apt/theme/[theme]` 6종 × 18지역 = 108 URL
  - low-jeonse-ratio / high-jeonse-ratio / price-up / price-down / new-built / high-trade
  - 지역 필터(?region=서울), JSON-LD FAQ, 유니크 분석, 안티스팸 5건 미만 notFound
- price-change-calc 크론 (매주 월 06:30, vercel.json 등록)
- 시군구 허브 → 테마 페이지 크로스 링크

### 안티스팸 7중 안전장치
1. 시군구 10개 / 동 5개 / 테마 5개 / 비교 양쪽 데이터 필수 임계값
2. 임계값 미달 → robots noindex + notFound() 이중 차단
3. 모든 페이지 데이터 기반 유니크 분석 문단
4. canonical URL 전량
5. JSON-LD 구조화 데이터 (FAQ + BreadcrumbList + Dataset + Article+Speakable)
6. 사이트맵 안티스팸 임계값
7. 공공데이터 출처 명시

### 예상 신규 인덱스 페이지
- 시군구 허브: ~200개
- 동 허브: ~1,500개
- 테마 페이지: 108개 (사이트맵 등록)
- 비교 페이지: on-demand ISR
- **합계: 기존 ~42,000 → ~44,000+ 페이지**

### 다음 단계 (PHASE 4 예정)
- 건설사 브랜드 페이지 (/apt/builder/[name])
- 가격대별 조합 페이지 (시군구 × 가격 티어)
- 월간 자동 리포트 크론
- total_households KAPT API 확장
- 리뷰/평점 시스템 → AggregateRating
- 109개 위성 사이트 백링크 전략
