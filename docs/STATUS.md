## 세션 103 — 부동산 전탭 히어로 카드 리디자인 + 현장 이미지 자동 크롤링

### 커밋: 0ea2c806 → a1181c74
### 변경: 10파일, +512 -176

### Part 1: 히어로 카드 리디자인 (7파일)
부동산 페이지 전체 탭(청약/분양중/미분양/재개발/실거래) + 단지백과 카드 섹션을 히어로 이미지(120px) 레이아웃으로 전면 리디자인.

#### 완료 — CSS 공용 시스템 (globals.css +119줄)
- `.hero-card` — 통일 카드 컨테이너 (hover 효과, border-radius)
- `.hero-img` — 120px 히어로 이미지 (모바일 100px)
- `.hero-overlay` — 하단 gradient 오버레이 (단지명+주소)
- `.hero-badges` — 좌상단 배지 영역 (상태/NEW/상한제/브랜드)
- `.hero-chip` — 우상단 칩 영역 (D-day, 진행률, 잔여세대)
- `.hero-img-sm` — 단지백과 소형 90px (모바일 80px)

#### 완료 — 6개 탭 카드 리디자인
- **SubscriptionTab**: 56px→120px 히어로, 상태배지+D-day+투기과열+상한제+브랜드 오버레이, 2순위 경쟁률 유지
- **OngoingTab**: 48px→120px 히어로, 분양중/미분양/PREMIUM 배지, 입주 D-day
- **UnsoldTab**: 48px→120px 히어로, 잔여세대 카운터 오버레이, 미분양 급증 배지
- **RedevTab**: 이미지 없음→120px OG 히어로, 진행률% 오버레이, 시공사 배지
- **TransactionTab**: 텍스트→120px 히어로, 거래가+등락% 오버레이
- **ComplexClient**: borderTop→90px 히어로(2열), 연차/TOP 배지 오버레이

#### 코드 정리
- NewBadge 미사용 import 3파일 제거
- Spark/makeTrend 미사용 코드 제거 (ComplexClient)
- SPECLT_RDN_EARTH_AT(투기과열), competition_rate_2nd(2순위 경쟁률), vsMax(직전거래 대비%), built_year 누락 복원

### Part 2: 현장 이미지 자동 크롤링 크론 (3파일)

#### 완료 — apt-image-crawl 크론 신규 (240줄)
- **Phase 1**: 네이버 부동산 API → complexNo 검색 → 사진 갤러리 수집 (조감도/투시도/배치도/모델하우스/평면도)
- **Phase 2**: 네이버 이미지 검색 API fallback (카테고리별 5쿼리, filter=large)
- 카테고리: 조감도(2), 투시도(1), 단지배치도(1), 모델하우스(2), 평면도(1) → 현장당 6~7장
- 배치: 15현장/회, 매일 11:30 UTC (20:30 KST) 실행
- 이미지 없는 apt_sites 우선순위 자동 처리
- 결과: apt_sites.images JSONB에 [{url, thumb, type, source}] 저장

#### 완료 — aptImageMap 호환성 (page.tsx)
- `.thumbnail || .thumb || .url` fallback 순서 — 기존+신규 포맷 모두 지원

#### 완료 — vercel.json
- 크론 스케줄: `30 11 * * *`
- functions maxDuration: 300

### 프로덕션 상태
- Vercel: dpl_Cc2w3bGLpBbDLUrqh2bD4aoWJDPf — READY
- 런타임 에러: 0건
- 이미지 크론: 매일 20:30 KST 자동 실행 (첫 실행 대기 중)
