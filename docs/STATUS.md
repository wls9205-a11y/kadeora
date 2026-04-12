# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-12 13:36 KST (세션 88)

## 세션 88 — SEO 최종 개선 + 피드/더보기/내비 개선

### 완료된 작업
1. **buildMeta v2 완전 재작성** — og-square 자동, max-image-preview, BUILD_DATE 고정, article:tag
2. **29개 페이지 일괄 SEO 수정** — og-square/naver:description/timestamp 안정화
3. **더보기 메뉴 개선** — 15→22항목, 5그룹(투자정보/주식/부동산/도구/설정), sub 설명, 터치타겟 확대
4. **피드 페이지 개선** — stock/apt 태그 직접링크, readingTime 350, alt 동적, 폰트 확대
5. **discuss/search SSR H1 추가**
6. **stock/compare SSR 전환** — CompareClient 분리, 크롤러용 noscript 테이블
7. **stock/compare+search layout JSON-LD** — BreadcrumbList + WebPage
8. **press BreadcrumbList JSON-LD 추가**
9. **apt/unsold/[id] 불필요 generateMetadata 제거** (redirect 페이지)
10. **모바일 하단탭 블로그 추가** — MOBILE_TABS 3→4탭, Link prefetch

### 빌드 이슈 해결
- apt/data SITE_URL→SITE 변수명 수정
- apt/data + stock/data TITLE→인라인 문자열
- stock/market title→t 변수명 수정
- stock/market desc→m.desc 변수명 수정

### 배포 상태
- ✅ READY (dpl_u2dite9orhzyeh1vcZWRCMSNrdB7)
- 런타임 에러 0건
- 프로덕션 검증 완료

### DB 작업
- cover_image category 중복 5건 정리 완료

### 미실행 (docs/SEO_FINAL_WORK_PLAN.md 참조)
- Phase 11: ItemList/SpeakableSpecification 추가
- Phase 12: 어드민 FocusTab SEO 위젯
- SSR 서술형 분석 텍스트 (stock 서브페이지 Thin Content)
- stock↔apt 크로스 내부 링크
- Last-Modified 헤더
- 네이버 카페/블로그 자동 크로스포스팅
