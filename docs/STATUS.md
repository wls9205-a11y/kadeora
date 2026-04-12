# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-12 19:00 KST (세션 89)

## 세션 89 — 블로그 전천후 설계안 v2 구현

### 완료

1. **Phase 0 DB 일괄 수정** — 영어→한글 치환(trade/subscription/active/closed), "약 약" 오타, placeholder 제거
2. **upcoming_projects 테이블** — 카더라 선점 콘텐츠 관리 (rumor→announced→open→closed 상태)
3. **blog-data-enrichment.ts** — apt_complex_profiles(34,537) + apt_transactions(497,413) + stock_quotes(1,846) 실데이터 주입 함수
4. **blog-quality-gate.ts** — 70점 미만 발행 차단 (인라인HTML/보일러플레이트/실데이터 유무/내부링크/표 체크)
5. **blog-enrich-rewrite 크론** — C등급 3,726건 실데이터 기반 재생성 (기존 blog-rewrite 대체)
6. **BlogSidebar.tsx** — 데스크탑 2컬럼 sticky 사이드바 (TOC+핵심지표+관련링크+도구)
7. **BlogMetricCards.tsx** — 핵심 지표 카드 (평당가/전세가율/세대수/연식 or 현재가/PER/시총/배당률)
8. **블로그 상세 페이지** — 사이드바 통합, apt_complex_profiles 메트릭 데이터 페치
9. **globals.css** — blog-detail-layout 2컬럼(1024px+), blog-content 가독성(17px, 1.85lh, h2 구분선)
10. **어드민 DataTab** — 블로그 품질 게이트 현황 (S/A/B/C/F 등급 분포, 인라인HTML 건수)
11. **admin/v2 API** — blogQuality 실시간 집계 추가
12. **blog-publish-queue** — 발행 시 품질 점수(seo_score/seo_tier) 자동 기록
13. **vercel.json** — blog-rewrite 제거 → blog-enrich-rewrite 추가 (매 3시간)
14. **설계 문서** — docs/BLOG_REDESIGN_MASTERPLAN.md + 카더라_블로그_전천후_설계안_v2.md

### 배포
- dpl_DSc3ybvW16b5bP4YvaQjt1p7AvFq — **READY** ✅

### 다음 세션 작업

1. **blog-upcoming-projects 크론** — 카더라 선점 콘텐츠 자동 발행 (전국 분양 예정 현장)
2. **/api/og-infographic** — 시세 차트/비교표 데이터 인포그래픽 자동 생성
3. **기존 크론 8개 프롬프트 교체** — district-guide, tax-guide, loan-guide, calculator-guide, life-guide, dividend-etf, subscription-monthly, regional-analysis
4. **Unsplash + 조감도 + 인포그래픽 3층 이미지 시스템** — 시공사 조감도 웹 검색 수집
5. **blog-data-update 크론** — 주간 조회수 상위 500글 시세 갱신
6. **불필요 크론 10개 비활성화** — cleanup-padding, fix-existing, restore-candidate, restore-monitor, adr-compare, apt-landmark, etf-compare, invest-calendar, monthly-market, weekly-market

### 핵심 아키텍처
- **원칙:** "데이터가 없으면 발행하지 않는다"
- **품질 게이트:** 70점+ pass, S(90+)/A(80+)/B(70+)/C(50+)/F
- **크론 정비:** 31개 → 24개 (유지12+교체8+신규4, 비활성화11)
- **콘텐츠 4타입:** TYPE A(단지분석), TYPE B(종목분석), TYPE C(카더라 선점), TYPE D(재테크 가이드)
- **이미지 3층:** 자체 인포그래픽 + 공신력 이미지(조감도) + Unsplash

### 완료 작업 요약

#### SEO 메타데이터 (36파일)
- buildMeta v2, og-square 자동, max-image-preview, BUILD_DATE 고정
- 29개 페이지 og-square/naver:description/timestamp 안정화
- JSON-LD 추가 (stock/compare, search, press BreadcrumbList)
- stock/compare SSR 전환 (CompareClient 분리)
- discuss/search SSR H1, apt/unsold redirect 정리

#### UX 개선
- 더보기 메뉴 15→22항목, 5그룹, sub 설명, 터치타겟 확대
- 피드 tag 직접링크, readingTime 350, alt, 폰트 확대
- 글쓰기 FAB 전환 → 하단탭 5개 균등배치
- ScrollToTop ↔ FAB 겹침 해결
- 글쓰기 페이지 디자인 개선 (제목 20px/800, 본문 16px)

#### 블로그 이미지 시스템
- Unsplash API 통합 (UNSPLASH_ACCESS_KEY 등록)
- 22,809개 이미지 배치 (7,603개 × 3장 캐러셀)
  - Position 0: Unsplash 실사진 (카테고리별 8장 라운드로빈)
  - Position 1: OG 인포그래픽 (데이터 카드)
  - Position 2: Unsplash 서브 사진
- BlogHeroImage: 스와이프, 좌우 화살표, 1/3 카운터, 도트 네비
- 크론: blog-generate-images 하루 4회 (02/08/14/20 UTC)
- OG 텍스트카드 히어로 제거 → blog_post_images만 렌더

#### UI 전수조사 표준화 (105파일, 518줄)
- fontSize: 8-9px → 10px (최소 가독성, 62건)
- borderRadius: 하드코딩 → CSS 변수 (radius-sm/md/card/lg/xl/pill)
- padding: 2px 6px → 3px 8px (뱃지 최소 크기)
- gap: 홀수 → 짝수 (3→4, 5→6)
- 터치 타겟: 24x24→28x28, 28x28→32x32 (접근성)
- Feed/Blog/Navigation 세부 조정

### 배포
- ✅ READY (dpl_7VQFEYnuxHEjaTpevTN5vGJiNYPw)
- 런타임 에러 0건

### 미실행 (다음 세션)
- /api/blog-chart 데이터 시각화 이미지 (시세 추이, 지역 비교)
- ItemList/SpeakableSpecification JSON-LD
- SSR 서술형 분석 텍스트 (Thin Content 해소)
- Last-Modified 헤더 (middleware)
- 어드민 FocusTab SEO 위젯
- SEO_REWRITE_PLAN 실행 (59K→15K)
