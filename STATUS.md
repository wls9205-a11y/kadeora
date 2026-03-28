# SEO/GEO/OG 전면 강화 작업 — 2026-03-28

## 완료 작업

### 1. 주식 상세 (`/stock/[symbol]/page.tsx`)
- [x] NYSE/NASDAQ 종목 → 뉴욕 좌표(40.7128;-74.0060), 한국 종목 → 서울 좌표 유지
- [x] `article:published_time` + `article:modified_time` 추가
- [x] `naver:written_time`을 `updated_at` 기반으로 변경 (new Date() 제거)

### 2. 주식 섹터 (`/stock/sector/[name]/page.tsx`)
- [x] JSON-LD 3종 추가: BreadcrumbList, ItemList(상위 10종목), FAQPage(3개 Q&A)
- [x] geo, naver:written_time, dg:plink, article:section/tag 메타 추가
- [x] twitter card 메타 추가

### 3. 부동산 상세 (`/apt/[id]/page.tsx`)
- [x] apt_sites에 latitude/longitude 있으면 geo.position에 동적 좌표 주입
- [x] 없으면 기존 지역 코드 폴백 유지 (17개 시도 좌표)

### 4. 부동산 지역 (`/apt/region/[region]/page.tsx`)
- [x] geo.position에 각 지역 중심 좌표 추가 (17개 시도 + 13개 주요 시군구)
- [x] ItemList JSON-LD 추가 (해당 지역 주요 단지)
- [x] 기존 BreadcrumbList, FAQPage, CollectionPage JSON-LD 유지

### 5. 블로그 상세 (`/blog/[slug]/page.tsx`)
- [x] jsonLd speakable cssSelector → `['h1', 'article p:first-of-type']`
- [x] image 필드: cover_image || 동적 OG URL (og-image.png 폴백 제거)

### 6. 블로그 목록 (`/blog/page.tsx`)
- [x] FAQPage JSON-LD 추가 (카더라 블로그란? 등 3개 Q&A)
- [x] 기존 ItemList JSON-LD 유지 (상위 10개 → Google 캐러셀)

### 7. 전역 레이아웃 (`layout.tsx`)
- [x] msvalidate.01 Bing 인증 메타 — 기존값 유지 (BAE0BF3F5071F16E8BAE497D195B2FD6)
- [x] RSS alternate 링크 추가 (주식, 부동산)

### 8. 주식/부동산 RSS 신규
- [x] `/stock/feed/route.ts`: 최근 업데이트된 종목 50개 RSS
- [x] `/apt/feed/route.ts`: 최근 청약/미분양 뉴스 RSS
- [x] robots.txt에 새 RSS sitemap 추가
- [x] layout.tsx head에 alternate RSS 링크 추가

### 9. OG 한글 폰트 수정
- [x] `/api/og/route.tsx`: Pretendard Bold woff2 폰트 fetch (CDN)
- [x] 모든 ImageResponse에 폰트 적용
- [x] 폰트 로드 실패 시 기존 시스템 폰트 폴백 유지

### 10. STATUS.md
- [x] 완료 작업 기록

---

## SEO 2차 강화 + 긴급 수정 — 세션 44 (2026-03-28)

### 1. robots.txt 통합
- [x] `public/robots.txt` 삭제 (동적 라우트가 override)
- [x] `src/app/robots.txt/route.ts`에 RSS Sitemap 5개 추가 (feed.xml, blog/feed, stock/feed, apt/feed)
- [x] image-sitemap.xml 유지

### 2. apt/feed RSS 링크 수정
- [x] 청약 아이템: `/apt/{id}` → `generateAptSlug()` → `/apt/{slug}`
- [x] 미분양 아이템: `/apt/unsold/{id}` → `generateAptSlug()` → `/apt/{slug}`

### 3. 홈페이지 JSON-LD WebSite + SearchAction
- [x] `page.tsx`에 WebSite + SearchAction JSON-LD 추가 (사이트링크 검색창)

### 4. 홈페이지 Organization.sameAs 제거
- [x] 빈 배열 `sameAs: []` 제거
- [x] 전역 레이아웃 `layout.tsx`의 sameAs도 제거 (SNS 없으므로)

### 5. /apt/diagnose layout.tsx 확장
- [x] title/description/canonical/OG/twitter/naver 메타 전부 추가
- [x] JSON-LD 3종: WebApplication, FAQPage(가점 만점?, 무주택 기간 계산법?, 부양가족 기준?), BreadcrumbList

### 6. /stock/compare layout.tsx 확장
- [x] canonical/OG/twitter/naver/daum 메타 추가
- [x] JSON-LD BreadcrumbList

### 7. naver:written_time 전면 수정
- [x] 정적 페이지 15개: `new Date().toISOString()` → 고정 날짜 `2026-01-15T00:00:00Z`
  - apt/map, apt/search, apt/page, apt/region, apt/complex, discuss, discuss/[id], feed, hot, guide, grades, stock, stock/sector, blog, blog/series
- [x] 동적 페이지: 실제 데이터의 created_at/updated_at 사용 (discuss/[id], blog/series/[slug])

### 8. IndexNow 블로그 발행 연동
- [x] blog-publish-queue 크론에서 발행 후 `submitIndexNow()` 호출
- [x] 기존 IndexNow 인프라 (lib, API route, key 파일) 확인 — 이미 구축됨

### 9. /apt/[id] AggregateRating
- [x] 이미 구현됨 (interest_count > 0일 때 JSON-LD에 aggregateRating 포함)

### 10. /apt/map JSON-LD Breadcrumb
- [x] 이미 구현됨

### 11. manifest.json + llms.txt 수치 업데이트
- [x] 15,502편, 5,522현장으로 업데이트

---

## TODO

- [ ] Supabase blog_posts 테이블에서 깨진/무효한 cover_image URL 정리 (NULL로 업데이트 또는 유효한 이미지로 교체)
