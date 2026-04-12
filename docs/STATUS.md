# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-12 15:20 KST (세션 88 최종)

## 세션 88 — SEO 종합 + UX + 이미지 시스템 + 중복 제거 + 어드민 개선

### 완료된 작업 (총 25건)

#### 1. SEO 메타데이터 (36파일)
- buildMeta v2 (og-square, max-image-preview, BUILD_DATE 고정, article:tag)
- 29개 페이지 og-square/naver:description/timestamp 안정화
- BreadcrumbList/WebPage JSON-LD 추가 (compare, search, press)
- stock/compare SSR 전환 (CompareClient 분리, noscript 테이블)
- discuss/search SSR H1, apt/unsold redirect 정리

#### 2. 모바일 UX (6건)
- 하단탭 5탭 균등배치 (피드/주식/부동산/블로그/더보기)
- 글쓰기 FAB (52px 우하단 플로팅)
- ScrollToTop ↔ FAB 겹침 해결
- 더보기 메뉴 15→22항목, 5그룹, sub 설명
- 피드 tag 직접링크, readingTime 350, alt, 폰트
- 글쓰기 디자인 개선 (제목 20px, 본문 16px)

#### 3. 블로그 이미지 시스템 (4건)
- DB: blog_post_images 테이블
- Unsplash API 통합 (카테고리별 5~8장 라운드로빈)
- **22,809개 이미지** (7,603글 × 3장 캐러셀)
  - Position 0: Unsplash 실사진
  - Position 1: 카더라 인포그래픽
  - Position 2: Unsplash 서브 사진
- BlogHeroImage: 스와이프, 좌우화살표, 1/3 카운터, 도트 네비
- 크론: blog-generate-images (하루 4회, 50개/배치)

#### 4. 중복 컨텐츠 전수조사 + 해소 (5건)
- blog-safe-insert.ts: v2 출처 블록 제거 (2중 삽입 방지)
- blog-safe-insert.ts: 면책문 본문 삽입 제거 → Disclaimer 컴포넌트에 위임
- blog/[slug]: 하단 Disclaimer compact 제거 (3중→1중)
- stock/page.tsx: page-level Disclaimer 제거 (StockClient 2중 중복)
- apt/[id]: 하드코딩 면책 → 출처 간단 표기

#### 5. 어드민 개선 (3건)
- AdminShell: 2탭→**7탭** 복원 (대시보드/이슈/성장/유저/데이터/운영/실행)
- FocusTab: 폰트 6-10px→**10-14px** (62곳), 색상 대비 +50%, 간격 2배
- IssueTab: 동일 가독성 개선

#### 6. CTA 점검
- 8개 CTA 컴포넌트 정상 사용 확인
- SignupCTA.tsx: dead code (미사용) 식별

### 배포 상태
- ✅ READY (dpl_AB2953hCxrd1vhpfhgJzVtMK6srB)
- 런타임 에러 0건

### 미실행 (다음 세션)
- 사업자정보 5곳 → FooterInfo 컴포넌트 분리
- SignupCTA dead code 정리
- calc FAQ 공통 답변 상수화
- /api/blog-chart 데이터 시각화 차트 이미지
- ItemList/SpeakableSpecification JSON-LD
- SSR 서술형 텍스트 (Thin Content)
- Last-Modified 헤더
- SEO_REWRITE_PLAN 실행
