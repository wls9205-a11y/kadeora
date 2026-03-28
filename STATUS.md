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
