## 세션 103 — 부동산 전탭 히어로 카드 리디자인

### 브랜치: design/hero-card-redesign
### 변경: 7파일, +265 -174

### 작업 내용
부동산 페이지 전체 탭(청약/분양중/미분양/재개발/실거래) + 단지백과 카드 섹션을 히어로 이미지(120px) 레이아웃으로 전면 리디자인.

### 완료 — CSS 공용 시스템 (globals.css +119줄)
- `.hero-card` — 통일 카드 컨테이너 (hover 효과, border-radius)
- `.hero-img` — 120px 히어로 이미지 (모바일 100px)
- `.hero-overlay` — 하단 gradient 오버레이 (단지명+주소)
- `.hero-badges` — 좌상단 배지 영역 (상태/NEW/상한제/브랜드)
- `.hero-chip` — 우상단 칩 영역 (D-day, 진행률, 잔여세대)
- `.hero-img-sm` — 단지백과 소형 90px (모바일 80px)

### 완료 — SubscriptionTab (청약)
- 56px → 120px 히어로 이미지 + 오버레이
- 상태배지/NEW/상한제/투기과열/브랜드/재개발 → hero-badges
- D-day → hero-chip (색상 코딩: 빨강≤1일, 주황≤3일, 파랑>3일)
- 경쟁률 링 + 2순위 경쟁률 유지
- 미사용 NewBadge import 정리

### 완료 — OngoingTab (분양중)
- 48px → 120px 히어로 + 분양중/미분양/PREMIUM/NEW/브랜드 배지
- 전매제한/무이자 → 이미지 하단 배지행
- 입주 D-day → hero-chip

### 완료 — UnsoldTab (미분양)
- 48px → 120px 히어로 + 잔여세대 카운터 오버레이
- 미분양 급증% 배지 → hero-badges
- 미사용 NewBadge import 정리

### 완료 — RedevTab (재개발)
- 이미지 없던 카드 → 120px OG 히어로 이미지 추가
- 진행률% → hero-chip 오버레이
- 유형/단계/시공사 배지 → hero-badges
- 진행바 인라인 유지

### 완료 — TransactionTab (실거래)
- 텍스트 전용 → 120px 히어로 + 거래가 오버레이
- 매매/신고가/등락% 배지 → hero-badges
- built_year 정보 유지

### 완료 — ComplexClient (단지백과)
- borderTop 3px → 90px 히어로 이미지 (2열 그리드)
- 연차 배지 + TOP 뱃지 → 이미지 오버레이
- 미사용 Spark/makeTrend 함수 제거
- 매매가 + 전세가율 게이지 유지

### 리스크 검토 완료
- ✅ TS 에러 — 기존 TS7006만, 신규 에러 0건
- ✅ 기능 보존 — watchlist/comment/alert/필터/페이지네이션 전부 유지
- ✅ OG 이미지 — aptImageMap 우선 → fallback /api/og 패턴 유지
- ✅ 누락 배지 — 투기과열/2순위경쟁률/vsMax/built_year 복원
- ✅ 미사용 코드 — NewBadge import 4파일, Spark/makeTrend 함수 정리
- ✅ 하드코딩 색상 — 이미지 오버레이용 rgba만 (CSS변수 불가 영역, 의도적)
