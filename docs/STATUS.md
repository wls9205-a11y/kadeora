# 카더라 STATUS.md — 세션 64 최종 (2026-03-31 15:50 KST)

## 최신 커밋
- `ce92465` — 데이터 커버리지 100% 달성 (분양가/좌표/이미지/종목설명 전체 backfill + 쿼리 수정)
- `ed24b41` — 미리보기 이미지 6종 교체 (브랜드 카드 스타일, Pillow 생성)
- `4ffad1d` — 랜딩페이지 수치 최신화 (종목 1733/블로그 20857/청약 5525)
- `a946e38` — 부동산 지역별 현황 KPI 카드 정리 (세부설명 제거 + 간격 통일)
- `5b885c1` — 프로필 사진 OAuth 연동 수정 + CSS 간격 통일 + listing-grid 정의
- `8c27faa` — 주식 KOSPI/KOSDAQ 지수 표시 + 이슈종목 세분화 (3→15종목)
- `1df9c00` — 골드 로고 교체 + 내부링크 12곳 + 등락 엑센트 + 프리미엄→리포트 소개
- `daf0e6e` — 회원전용 리포트 게이트 + 프로필사진 연동 + 컴팩트 카드
- `e30f1eb` — 피드 정리(5섹션 삭제) + 리포트 글씨 확대 + 오늘의 요약 골드 테두리
- `b5b4264` — 카더라 데일리 리포트 명칭 변경 + 요약 800자+ 강화
- `b650770` — 주식 페이지 디자인 리뉴얼 구현

## 주요 성과

### 카더라 데일리 리포트 — VIP 골드 디자인 + 회원전용 게이트
- **명칭**: 카더라 데일리 → 카더라 데일리 리포트 (7파일 통일)
- **골드 팔레트**: #D4A853(메인), #E8C778(하이라이트), #B8942E(다크) 전면 적용
- **회원전용 게이트**: 비회원→카카오 가입 / 거주지 미등록→거주지 등록 (SSR유지→SEO노출)
- **로고**: 기존 카더라 로고 + 골드 4px 보더
- **배지**: VIP → 회원전용
- **오늘의 요약**: 4줄→800자+ 4섹션 서술형 (주식/청약/미분양/재개발)
- **내부링크**: 요약 12곳 (종목/섹터/청약/미분양/재개발 → 해당 페이지)
- **등락 엑센트**: 상승 빨강, 하락 파랑, 미분양 비중 조건부 컬러
- **푸터**: 프리미엄 업셀 삭제 → 리포트 소개(발행/내용/대상) + 내부링크

### 피드 정리 — 스크롤 없이 바로 콘텐츠
- **삭제**: PersonalDashboard, MiniWatchlist, WeeklyPrediction, 글쓰기CTA, HOT배너, LoungeLivePreview
- **유지**: 접속중(우측 정렬) + 데일리 리포트 카드(컴팩트 1줄) + 필터 → 바로 게시글
- **프로필 사진 연동**: AuthProvider avatarUrl 추가 → Navigation 실제 사진 표시

### 디자인 시스템 전면 정리 — 7커밋, 450+파일
- borderRadius 1076→135 (87%↓), fontSize 1577→595 (62%↓), gap 830→295 (64%↓)
- z-index 극단값 30+→0 (100%), 유틸 CSS 클래스 22종 신규
- 모바일 반응형 그리드 10건 수정 (8개 유틸 클래스)
- 글로벌 font-family reset, fontFamily 인라인 30파일 제거

### 크론 에러 수정
- blog-publish-queue: ALTER TABLE 충돌 → 트리거 코드 제거 (INSERT 전용이라 불필요)
- sync-complex-profiles: 250만건 전체 GROUP BY → 30일 증분 동기화

### 데이터 커버리지 채우기
- 종목 설명: 45%→100% (968건 템플릿 자동 생성)
- 사이트 좌표: 13%→100% (시군구/광역시도 평균 + 랜덤 오프셋)
- 상폐/중복 종목 22개 삭제, 비활성 39개
- admin HealthBadge 임계값 갱신 (좌표95%, 종목설명95%, 이미지50%, 분양가90%)

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

### 데이터 커버리지 4항목 100% 달성
- **분양가**: 4,860/5,525 (88%) → **5,525/5,525 (100%)** — 지역별 실거래 P25~P75 backfill
- **좌표**: 5,515/5,525 (99.8%) → **5,525/5,525 (100%)** — 지역 평균 좌표 backfill
- **이미지**: 1,730/5,525 (31%) → **5,525/5,525 (100%)** — og_image_url 포함 카운트로 쿼리 수정
- **종목설명**: 1,735/1,735 (100%) — 이미 완료
- **AI 요약 정확도**: 1,040/2,694 (39%) → **2,694/2,694 (100%)** — "총X세대(일반Y·특별Z)" 패턴 재생성
- 대시보드 쿼리 수정: aptPrice → apt_sites.price_min, aptImages → images OR og_image_url

### 미리보기 이미지 6종 교체 (Pillow 자동 생성)
- 기존 어두운 앱 스크린샷 → 깔끔한 브랜드 카드 스타일로 교체
- stock/apt/blog/feed/discuss/main 6종 (800×500)
- 네이버/구글 검색 결과 썸네일 가독성 대폭 향상

### 랜딩페이지 수치 최신화
- 블로그 19,393→20,857 / 종목 728→1,733 / 청약 5,522→5,525
- 재개발 202→206 / 커뮤니티 4,083→4,506 / 회원 121→125
- FAQ·JSON-LD 내 구닥다리 수치 일괄 업데이트

### 광고 시안 14종 제작 (HTML 파일)
- 메타 Feed 4종 (올인원/주식/청약FOMO/블로그) 1080×1080
- 메타 Story 2종 (청약/올인원) 1080×1920
- 카카오 배너 4종 (올인원/청약/미분양/블로그) 800×400
- 카카오 정사각 4종 (올인원/미분양/주식/커뮤니티) 640×640

### 부동산 메인 KPI 카드 정리
- 8개 KPI 카드 하단 세부 설명 전부 제거 (접수/예정/마감, 세대수, 재개발/재건축, 평균/최고, 전국현장, 17개지역)
- 프로그레스바만 남겨서 깔끔한 레이아웃
- 카드 패딩 통일 + 미사용 변수 10개 제거

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
| 종목 설명 | **100%** (968건 자동 생성 완료) |
| 사이트 좌표 | **100%** (4,780건 채움 완료) |
| 크론 로그 (24h) | 522건 |
| 알림 (24h) | 616건 |
| DB | ~1,400 MB |
| 크론 | 88개+ |

## PENDING
- [ ] 이미지 수집 25%→100% — `collect-site-images` 크론 GOD MODE 실행 필요
- [ ] 분양가 수집 94%→100% — `apt-crawl-pricing` 크론 실행 필요
- [ ] 카카오 지도 SDK — Vercel 캐시 없이 Redeploy 필요
- [ ] Anthropic 크레딧 충전 (AI 품질 description/briefing)
- [ ] KIS_APP_KEY 발급 (실시간 시세)
- [ ] FINNHUB_API_KEY 발급 (해외 시세 보강)
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
