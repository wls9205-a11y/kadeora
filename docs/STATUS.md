# 카더라 STATUS.md — 세션 64 최종 (2026-03-31 12:00 KST)

## 최신 커밋
- `b650770` — 주식 페이지 디자인 리뉴얼 구현 (헤더/AI시황/지수KPI/섹터트리맵/종목카드 전면 교체)
- `6788a5c` — 전 페이지 강화 6건 (무섹터0/테마23개/pill탭/guessSector확장/시리즈SSG)
- `55026e0` — 포털 노출 면적 최대화 (전 메인 OG 630x630 + max-video-preview)
- `1141e75` — 피드/부동산 1열 전환 + 주식 페이지 리뉴얼 (탭5개+pill+심리지수데이터기반)
- `62bf14d` — 주식 SEO 전면 자동화 + 종목/섹터 대량 강화
- `6e671cb` — stock-naver-sync 크론 신설 (국내500+해외500 네이버 크롤링)

## 주요 성과

### 포털별 노출 면적 최대화 (전수조사 완료)
- **OG 듀얼 이미지**: 전 메인 페이지 1200x630 + 630x630 동시 등록 (feed/stock/apt/blog/hot/discuss)
- **max-video-preview: -1**: Google 비디오 리치결과 허용 (layout.tsx)
- **구조화 데이터 현황** (포털 SERP 확장):
  - BreadcrumbList: 전 페이지 ✅
  - FAQPage: stock, apt, apt/region, apt/[id], complex, daily, hot, premium, grades ✅
  - Article/BlogPosting + Speakable: blog, feed/[id], stock/[symbol], apt/[id], daily ✅
  - Organization + WebSite + SearchAction: layout.tsx ✅ (Google 사이트링크 검색 박스)
  - SiteNavigationElement: layout.tsx 6항목 ✅ (Google 확장 사이트링크)
  - Event + HowTo: apt/[id] 청약 ✅
  - Product + AggregateOffer + AggregateRating: apt/[id], premium ✅
  - FinancialProduct + Dataset: stock/[symbol], complex ✅
  - Place + GeoCoordinates: apt/[id], complex ✅
  - Naver 메타 (site_name, author, written/updated_time): 전 페이지 ✅
  - Daum 메타 (daum:site_name): layout.tsx ✅
  - max-image-preview: large, max-snippet: -1: layout.tsx ✅

### 주식 페이지 디자인 리뉴얼 (mockup → 구현 완료)
- **헤더**: 이모지 제거, 시장 상태 pill 심플화, 비교/새로고침 미니멀
- **AI 시황 카드**: gradient 배경 제거 → 심플 카드, 상승TOP/하락TOP/환율 3열 KPI 추가
- **지수 KPI**: 3열 스파크라인 → **4열 좌측 컬러보더** (KOSPI/KOSDAQ/S&P/USD-KRW)
- **섹터 히트맵**: pill 태그 → **비대칭 트리맵 그리드** (1위 2fr + 상위4 + 하위5, 대표종목 표시)
- **종목 카드**: 가로 리스트 → **2열 카드형** (상단 등락 컬러바 + 섹터 pill + full-width fill area 차트 + 시총/거래량)

### 전 페이지 전수조사 + 강화 6건 (세션 64 후반)
- KOSDAQ 무섹터: 678 → **0** (DB 일괄 배정, 30개 패턴 regex)
- KOSPI 무섹터: 51 → **0**
- US 무섹터: 이미 0 ✅
- 투자 테마: 8개 → **23개** (양자컴퓨팅/UAM/크립토/원전/우주/사이버보안/K-뷰티/HBM/EV/K-방산/빅테크/조선/금리/관세/엔저)
- 주식 상세 탭: 세그먼트 → **pill 스타일** (메인과 통일)
- guessSector: 22패턴 → **28패턴** (신규 크롤링 자동 섹터 배정)
- stock-theme-daily: US 종목 포함 + date/is_hot 자동 갱신
- 블로그 시리즈: **generateStaticParams 추가** (정적 생성 + ISR)

### 레이아웃 전환 + 주식 페이지 리뉴얼
- listing-grid: 2열→1열 기본 (피드/부동산/블로그) — 모바일 깨짐 근본 해결
- listing-grid-2col: 주식 전용 2열 유지
- AI 심리지수: Math.random() → 실제 상승/하락 비율 기반
- 평균등락: change_pct=0 제외 → 정확한 평균
- 탭: 8개→5개 (시총/등락률/섹터/테마/관심) pill 스타일
- 글로벌 지표 pill (USD/KRW + GLD/USO/TQQQ/SOXL)
- 섹터 미니 히트맵 상시 표시 (상위 10개 섹터 등락률)

### 주식 시세 정상화 + 네이버 크롤링 + US 종목 대량 추가
- 비정상 등락률 전부 수정 (±30% 클램프)
- stock-naver-sync 크론: 국내500+해외500 매 10분
- US 종목 124개 대량 추가 (총 1,794종목)
- SEO 전면 자동화 (사이트맵/generateStaticParams/IndexNow 전부 DB 동적)
- 등락률 커버리지: KOSPI 70.5% / KOSDAQ 67.2% / NYSE 68.5% / NASDAQ 81.2%

### 디자인 시스템 전면 정리 (세션 64) — 5커밋, 400+파일
- **CSS 토큰 정의 → 실적용 완료**: --sp-*, --radius-*, --transition-*, --z-* 전부 TSX에서 활용
- **z-index 통일**: 9999/10000/99999 등 카오스 → 체계적 스케일 (nav:50, modal:90, toast:100, overlay:200) — 19파일
- **borderRadius 토큰화**: 하드코딩 1076→135건 (87%↓) — 230+파일
- **fontSize CSS 변수 확대**: 하드코딩 1577→595건 (62%↓) — 55파일
- **gap 토큰화**: 하드코딩 830→295건 (64%↓) — 126파일
- **marginBottom 토큰화**: 하드코딩 900→222건 (75%↓) — 115파일
- **fontWeight 계층 정리**: 700 독점(755건) → 600:597/700:569/800:350 균형 분포 — 75파일
- **transition 토큰**: 하드코딩 → var(--transition-fast/normal) — 25파일
- **padding 토큰**: 6개 공통 패턴 → CSS 변수 조합 — 93파일
- **하드코딩 색상 전환**: #34D399→var(--accent-green) 등 — 8파일
- **유틸리티 CSS 클래스 14종 추가**:
  - kd-card-base, kd-badge(7종), kd-action-btn, kd-tab-btn
  - kd-pill, kd-sort-btn, kd-tag, kd-section-header
  - kd-avatar(3사이즈), kd-interaction-bar, kd-stat-grid
  - kd-progress, kd-scroll-row, kd-tabular
- **FeedClient 클래스 적용**: 탭/정렬/필터/태그/인터랙션 → CSS 클래스로 전환
- **aria-label 접근성 보강**: 닫기/공유 버튼 12파일
- **죽은 CSS 제거**: filter-pills, blog-toc-sidebar, nav-bar, tab-bar, 미사용 responsive 클래스 25개
- **color var()**: 2,128→2,489 (+17%)
- Vercel 5배포 전부 READY, TS 에러 0
- **모바일 반응형 전수조사**: 320~480px 그리드 오버플로우 10건 수정
  - kd-kpi-5: 5열→480px 3열/380px 2열
  - kd-grid-4: 4열→480px 2열 (apt/stock/profile)
  - kd-grid-3: 3열→420px 2열 (complex)
  - kd-grid-1-2: 1fr+2fr→480px 1열 (apt/region)
  - kd-grid-6: 6열→480px 3열/380px 2열 (daily global)
  - kd-cal-grid: 7열 캘린더→380px 축소 (subscription)
  - kd-region-grid: 5열→380px 4열/320px 3열
  - kd-stats-4: 4열→380px 2열 (profile)

### B-2 도넛 리디자인 (최종)
- 2×4 그리드 8칸: 청약/분양중/미분양/재개발·재건축/실거래(2026)/단지백과/분양사이트/부동산지도
- 프로그레스바: 각 칸 전체 대비 비율 바
- 서브뱃지: 접수 5/예정 11/마감 984, 재개발 165/재건축 37, 68,264세대
- 설명글: 각 탭 주제 한줄 설명 (9px, 2줄 제한)
- 전국 통일: 특정 지역 표기 → "전국" 통일
- 클릭: 각 카드 → 해당 탭 전환 / 단지백과·분양사이트·지도 → router.push
- 모바일: 480px/380px 브레이크포인트

### 주식 크론 5개 AI 폴백 완성
- stock-desc-gen: 템플릿 폴백 50건/배치 (AI 없이도 description 자동 생성)
- stock-daily-briefing: 데이터 기반 자동 브리핑 (상승TOP3/하락TOP3/섹터)
- stock-news-crawl: 등락률+거래량 기반 자동 노트 (조기리턴 제거)
- stock-flow-crawl: 시총×거래량×등락 기반 수급 추정 (조기리턴 제거)
- guessSector: 17→22패턴 (AI/로봇, 전기장비, 뷰티, 반도체장비 추가)

### 주식 데이터 정확성 수정
- 삼성전자 시총: 330조 → 1,044조 (네이버 기준 보정)
- SK하이닉스 시총: 657조 → 622조
- price=0 상폐 종목 2건 삭제 (락앤락 2024.12 상폐, 피앤씨테크)
- 대형주 섹터 일괄 배정 (삼천당→바이오, 두산→지주, 레인보우로보→AI/로봇)
- 무섹터: 846건 → ~729건 (117건 해결)

### DailyReportCard 리디자인
- 그라데이션 배경 + 브랜드 보더 1.5px
- "읽기 →" CTA 버튼 (brand pill)
- 핵심 지표 3칸: 시총1위 / 이번주 청약 / 전국 미분양
- 날짜: "3월 31일 월요일" 형식 + 주말판 표시

### 모바일 2열 카드 수정
- listing-grid 1열 폴백: 420px → 320px
- 대부분 모바일에서 2열 유지

### 이미지 높이 최적화 (4곳)
- complex/[name], region/[region], discuss/[id]: maxHeight 160px
- blog/[slug]: maxHeight 280px + borderRadius

### 부동산 지도 수정
- 분양중 데이터 fetch 추가 (기존에 빠져있었음)
- 기본 레이어 4개 전체 활성화
- SDK 에러 UI → 컴팩트 안내 메시지

## 데이터 현황 (라이브)
| 항목 | 수치 |
|------|------|
| 블로그 | 20,857편 (발행 20,857) |
| 커뮤니티 글 | 4,506편 · 댓글 3,318개 |
| 유저 | 125명 |
| 매매 실거래 | 496,987건 |
| 전월세 실거래 | 2,099,311건 |
| 단지백과 프로필 | 34,495개 |
| apt_sites | 5,525개 |
| 청약정보 | 2,694건 |
| 미분양 | 213건 |
| 재개발 | 206건 |
| 주식 종목 | 1,733개 활성 (KOSPI 279/KOSDAQ 983/NYSE 285/NASDAQ 186) |
| 주식 무섹터 | **0건** (전종목 섹터 배정 완료) |
| 투자 테마 | 23개 (15개 신규 추가) |
| 주식 비활성 | 39개 (상폐/미갱신) |
| price_history | 27,685 rows |
| 섹터 없음 | 729종목 (pending) |
| 설명 없음 | 968종목 (pending) |
| 크론 로그 (24h) | 522건 |
| 알림 (24h) | 616건 |
| DB | ~1,400 MB |
| 크론 | 88개+ |

## PENDING
- [ ] 카카오 지도 SDK — Vercel 캐시 없이 Redeploy 필요
- [ ] Anthropic 크레딧 충전 (AI 품질 description/briefing)
- [ ] KIS_APP_KEY 발급 (실시간 시세)
- [ ] FINNHUB_API_KEY 발급 (해외 시세 보강)
- [ ] 주식 페이지 UI 강화 (시세 갱신 시간 표시, 52주 고저)
- [ ] 무섹터 729건 추가 해소 (guessSector 패턴 확장 or AI)
- [ ] 무설명 968건 해소 (Anthropic 크레딧 충전 후)
- [ ] 통신판매업 신고 후 푸터 번호 추가

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
12. **디자인 토큰 우선**: borderRadius→var(--radius-*), gap/margin→var(--sp-*), fontSize→var(--fs-*), z-index→var(--z-*) 사용. 하드코딩 px 금지 (4px 이하 micro값 제외)
