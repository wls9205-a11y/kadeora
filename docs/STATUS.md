# 카더라 STATUS.md — 세션 70 최종 (2026-04-03 KST)

## 최신 커밋
- 세션70: 글씨 크기 시스템 상향, 가독성 대폭 개선, 화이트 모드, 블로그 CTA, 통계 자료실, 더보기 재설계

## 세션 70 전체 성과

### 글씨 크기 시스템 전면 재설계 ✅
- 기본값(`:root`) = 기존 "크게" 수준으로 상향 (fs-base: 16→18px)
- 작게(`font-small`) = 기존 보통 수준, 크게(`font-large`) = 새 대형 스케일
- 간격 시스템(`--sp-*`, `--btn-h`, `--card-p`) 전체 동기화
- 모바일/데스크탑/태블릿 반응형 오버라이드 갱신

### 전체 가독성 대폭 개선 ✅
- text-primary: #E8EDF5 → #F2F5FA (+밝기)
- text-secondary: #94A8C4 → #B8CCDF (+밝기 25%)
- text-tertiary: #6B82A0 → #8BA3C0 (+밝기)
- border: #1A2A4A → #1E3258 (+가시성)
- bg-surface: #0C1528 → #0D1730 (카드 구분감 강화)
- 블로그 본문 p: text-secondary → text-primary + opacity 0.92
- 모든 액센트 컬러 밝기 +10%

### 화이트(라이트) 모드 추가 ✅
- `html.theme-light` CSS 변수 시스템 (배경/텍스트/카드/인풋/네비)
- ThemeProvider: useTheme() 훅 + toggleTheme() + localStorage 영속
- layout.tsx 인라인 스크립트 FOUC 방지
- 헤더/하단탭바 배경 테마별 자동 전환

### 블로그 회원가입 CTA 3종 ✅
- BlogTopBanner: 브레드크럼 아래 상단 배너 (닫기 가능)
- BlogMidCTA: 본문 후 카테고리별 맞춤 문구 카드
- BlogFloatingCTA: 스크롤 25% 시 플로팅 하단 배너

### 통계 자료실 신규 (/apt/data, /stock/data) ✅
- 부동산: 17개 시도별 청약/미분양/단지백과 CSV 다운로드
- 주식: KOSPI/KOSDAQ/NYSE/NASDAQ 시세/섹터/히스토리 CSV
- CSV API 6개: apt-subscription, apt-unsold, apt-complex, stock-prices, stock-sectors, stock-history
- DataCatalog JSON-LD + OG/SEO 완비

### 더보기 메뉴 재설계 ✅
- 4개 카테고리 그룹: 투자 정보 / 주식 / 부동산 / 설정
- 테마 전환 버튼 통합 (다크↔라이트)
- 통계 자료실 링크 추가

### SEO/Sitemap/Robots 갱신 ✅
- sitemap: /apt/data, /stock/data 추가
- robots.txt: data 경로 Allow 추가
- Google Font(Inter) 제거 → Pretendard CDN 단일화 (번들 최적화)

### 어드민 갱신 ✅
- dashboard: 릴리즈노트 세션70, 날짜 갱신

## 크론 현황 (총 95개)
변경 없음 (세션69 유지)

## PENDING
- [ ] 토스 심사: 결제경로 스크린샷 4장 캡처 → 이메일 첨부 발송
- [ ] 호스팅어 WordPress 자동발행 비활성화 (hPanel에서 직접)
- [ ] KIS_APP_KEY / FINNHUB_API_KEY
- [ ] 통신판매업 신고
- [ ] Phase 4: 주간 뉴스레터 (다음 세션)
- [ ] Lighthouse 성능 프로파일링 + 최적화
- [ ] 페이지별 콘텐츠 약점 전수 감사

## 아키텍처 규칙 (13개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선 13. DB 신규 컬럼 접근 시 (sb as any).from() 패턴 필수
