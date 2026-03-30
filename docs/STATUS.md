# 카더라 STATUS.md — 세션 61 최종 (2026-03-31 02:20 KST)

## 최신 커밋 체인
- `41c4f7a0` — seo: 포털 노출면적 만점 — FAQPage+Speakable+article 시간 보완
- `fbfaa189` — fix: sitemap/robots 3건 — grades 추가, shop 충돌, notifications 차단
- `3dd24def` — design: 피드 2열 카드 레이아웃 (V1)
- `c78e4369` — fix: fetchAptData return 누락 수정
- `a2359d46` — design: 2열 카드 — 부동산 3탭 + 재개발 뱃지 + 지역 4열
- `664cae91` — design: 부동산 통계 간결화 — 설명글 제거 + 프로그레스 바
- `e0517c12` — fix: BlogToc 스크롤 버그 3건
- `f31839ca` — fix: RegionStackedBar TS implicit any
- `619ed8d6` — design: 블로그 TOC 가로 칩 스크롤 + 커버 중복 제거 + 사이드바 제거
- `ff89fda1` — design: 블로그 상세 히어로 리포트 디자인

## 세션 61 주요 성과

### 1. 블로그 디자인 리뉴얼
- 블로그 목록: 매거진+타임라인 통합 (히어로 카드 + 날짜 구분선)
- 블로그 상세: 히어로 리포트 디자인 (그라데이션 카드 + 전문가 뱃지)
- 가로 칩 TOC: sticky top:56px + IntersectionObserver + 스크롤 버그 3건 수정
- 커버 이미지 중복 제거: enhanceBlogVisuals insertCoverImage 비활성화
- 사이드바 TOC 제거 → 단일 컬럼 780px
- H2 왼쪽 보더 3px brand / H3 왼쪽 보더 2px border

### 2. 2열 카드 레이아웃 — 전 페이지 적용
- CSS: .listing-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
- @media (max-width: 420px) → 1열 폴백
- 적용 대상: SubscriptionTab, OngoingTab, RedevTab, FeedClient, blog/page, StockClient(기존)
- 카드 패딩 컴팩트화 (14→12px), 아바타 32→28px, 갤러리 90→70px

### 3. 부동산 통계 간결화
- 2×4 카드 설명글 8개 완전 제거 → 높이 30% 줄어듦
- 지역 타일: 3열→4열, 스택바→단일 프로그레스 바, 폰트 12/11px
- 재개발 세부 뱃지: SSR에서 재개발 165 / 재건축 37 카운트 전달

### 4. 사이트맵 + robots.txt 전수 감사
- /grades 사이트맵 누락 → 추가
- /shop sitemap-Disallow 충돌 → sitemap에서 제거
- /notifications Disallow 추가
- 총 67,108 URL (sitemap 0~7, 10~16)

### 5. 포털 노출면적 만점 (15/15)
- 전 페이지 10/10: OG 3종 + Naver 3종 + BreadcrumbList + FAQPage + Speakable + thumbnailUrl
- blog/series: FAQPage+Speakable 추가
- region/sector/discuss: article:published/modified_time 추가

## 아키텍처 규칙 (11개 — 변경 없음)
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
