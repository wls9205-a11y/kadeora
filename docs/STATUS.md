# 카더라 STATUS.md — 세션 64 최종 (2026-03-31 10:00 KST)

## 최신 커밋
- `7c82768` — 모바일 2열 레이아웃 수정 (listing-grid minmax(0,1fr) + min-width:0)
- `62bf14d` — 주식 SEO 전면 자동화 (사이트맵 동적 + generateStaticParams + IndexNow)
- `e88ce80` — US 종목 88개 대량 추가 + 크론 limit 확대
- `9fe58b5` — NASDAQ .O/.N suffix 지원
- `6e671cb` — stock-naver-sync 크론 신설 (국내500+해외500 네이버 크롤링)
- `0a7ed7e` — stock change_pct ±30% 클램프 — 비정상 등락률 재발 방지
- `eefe3b2` — 피드 강화 6종 (실시간활동+관심종목+예측랭킹+리액션+라운지프리뷰+베스트댓글)

## 주요 성과

### 세션 64: 주식 시세 전면 수정 + 네이버 크롤링 + US 종목 대량 추가 + 모바일 2열 수정

#### 주식 시세 정상화
- 비정상 등락률 (-8247%, -3735% 등) 전부 수정 → 0건
- change_pct ±30% 클램프 적용 (stock-crawl + stock-refresh)
- price_history 3/24 이전 오염 데이터 수정 (3/25 가격 기준 통일)
- 전 종목 change_pct price_history 기반 재계산

#### 네이버 벌크 크롤링 크론 신설 (stock-naver-sync)
- 국내: 시총순 500종목 네이버 모바일 API (15병렬 × 80ms)
- 해외: 시총순 500종목 네이버 해외주식 API (20병렬 × 60ms)
- NASDAQ .O / NYSE .N suffix 자동 적용 + 폴백
- price_history에 오늘 종가 자동 기록
- 매 10분 실행 (평일 KST 09:00~16:00)
- 첫 실행 결과: 국내 477성공(96%), 해외 113성공(56%)

#### US 종목 124개 대량 추가
- 빅테크: GOOG, CSCO, ACN, TXN, IBM, SNPS, CDNS, DELL, HPQ
- 전자상거래/핀테크: MELI, NU, CPNG, FUTU, TIGR, FOUR, TOST
- 소셜/미디어: SNAP, PINS, ROKU, RDDT, ZM, DUOL, NFLX
- 양자컴퓨팅: IONQ, RGTI, QBTS
- UAM/우주: ACHR, JOBY, ASTS, LUNR, RDW
- 원자력/에너지: CCJ, LEU, SMR, VST, CEG
- 크립토: MSTR, MARA, RIOT, WULF, CLSK
- 방산: KTOS, RCAT, BWXT
- ETF 16종: TQQQ, SOXL, SPXL, ARKK, GLD, SLV, TLT, USO, VNQ, VOO, VTI, SCHD, JEPI, XLK~XLV, KWEB, EEM, EWJ, FXI, SQQQ, UVXY
- 한국 ADR: KB, SHG, PKX, LPL, SKM, KT
- 총 종목: KOSPI 293 + KOSDAQ 1,013 + NYSE 294 + NASDAQ 194 = **1,794**

#### SEO 전면 자동화 (종목 INSERT만 하면 전부 자동)
- sitemap SECTORS: 하드코딩 → DB 동적 조회 (55개 섹터)
- generateStaticParams: stock/[symbol] + sector/[name] 전부 DB 동적
- IndexNow: 최근 100종목 + 전 섹터 URL 자동 제출
- RSS feed: 50개 → 200개 확대
- isIdx: ETF 27종 + sector=ETF 자동 판별

#### 모바일 2열 레이아웃 수정
- listing-grid: repeat(2, 1fr) → repeat(2, minmax(0, 1fr))
- 그리드 아이템 min-width:0 + overflow:hidden
- SubscriptionTab 카드: KPI/타임라인/주소 overflow 처리

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
| 블로그 | 20,857편 |
| 매매 실거래 | 496,987건 |
| 전월세 실거래 | 2,095,019건 |
| 단지백과 프로필 | 34,495개 |
| apt_sites | 5,522개 |
| 주식 종목 | 1,794개 (KOSPI 293/KOSDAQ 1,013/NYSE 294/NASDAQ 194) |
| price_history | 28,432+ rows |
| 유저 | 121명 |
| DB | ~1,383 MB |
| 크론 | 79개+ (stock-naver-sync 추가) |

## PENDING
- [ ] 카카오 지도 SDK — Vercel 캐시 없이 Redeploy 필요
- [ ] Anthropic 크레딧 충전 (AI 품질 description/briefing)
- [ ] KIS_APP_KEY 발급 (실시간 시세)
- [ ] FINNHUB_API_KEY 발급 (해외 시세 보강)
- [ ] 주식 페이지 UI 강화 (시세 갱신 시간 표시, 52주 고저)
- [ ] 무섹터 ~729건 추가 해소
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
