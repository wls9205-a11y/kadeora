# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-12 15:03 KST (세션 88 최종)

## 세션 88 — SEO 종합 + UX + 이미지 시스템 + 중복 제거

### 완료된 작업 (총 20건)

#### SEO 메타데이터 (36파일)
- buildMeta v2 (og-square, max-image-preview, BUILD_DATE 고정, article:tag)
- 29개 페이지 og-square/naver:description/timestamp 안정화
- BreadcrumbList/WebPage JSON-LD 추가 (compare, search, press)
- stock/compare SSR 전환 (CompareClient 분리, noscript 테이블)
- discuss/search SSR H1, apt/unsold redirect 정리

#### 모바일 UX
- 하단탭 블로그 추가 → 5탭 균등배치 (피드/주식/부동산/블로그/더보기)
- 글쓰기 FAB 전환 (52px 우하단 플로팅)
- ScrollToTop ↔ FAB 겹침 해결
- 더보기 메뉴 15→22항목, 5그룹, sub 설명
- 피드 tag 직접링크, readingTime 350, alt, 폰트 확대
- 글쓰기 페이지 디자인 개선 (제목 20px, 본문 16px)

#### 블로그 이미지 시스템
- DB: blog_post_images 테이블 (post_id, image_url, alt_text, caption, type, position)
- Unsplash API 통합 (카테고리별 8~5장 라운드로빈)
- 7,603개 전체 글 × 3장 캐러셀 = **22,809개 이미지 배치**
  - Position 0: Unsplash 실사진
  - Position 1: 카더라 인포그래픽
  - Position 2: Unsplash 서브 사진
- BlogHeroImage: 터치 스와이프, 좌우 화살표, 1/3 카운터, 도트 네비
- OG 텍스트카드 히어로 제거 → 실사진으로 교체
- 크론: blog-generate-images (하루 4회, 50개/배치)

#### 중복 컨텐츠 전수조사 + 해소
- blog-safe-insert.ts: v2 출처 블록 제거 (2중 삽입 방지)
- blog-safe-insert.ts: 면책문 본문 삽입 제거 → Disclaimer 컴포넌트에 위임
- blog/[slug]: 하단 Disclaimer compact 제거 (3중→1중)
- stock/page.tsx: page-level Disclaimer 제거 (StockClient와 2중 중복)
- apt/[id]: 하드코딩 면책 → 출처 간단 표기 (Disclaimer 통합)

### 배포 상태
- ✅ READY (dpl_m78wb59EWtjcE7XWRngdmXRSni7A)
- 런타임 에러 0건

### 미실행 (다음 세션)
- 사업자정보 5곳 하드코딩 → FooterInfo 컴포넌트 분리
- calc FAQ 공통 답변 상수화
- /api/blog-chart 데이터 시각화 차트 이미지
- ItemList/SpeakableSpecification JSON-LD
- SSR 서술형 텍스트 (Thin Content 해소)
- Last-Modified 헤더
- SEO_REWRITE_PLAN 실행
