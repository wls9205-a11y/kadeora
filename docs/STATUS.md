# 카더라 STATUS.md — 세션 70 최종 (2026-04-03 KST)

## 최신 커밋
- `85b7078d` — 세션70-4: 부산 분양가 CSV 39단지, apt/data 특별자료 카드, 가이드북 갱신
- `06e4bfdc` — 블로그 3편 읽기 게이트 (Node: SEO 봇 전체본문 + 비로그인 하루 3편)
- `33867f7f` — 세션70-3: 라이트모드 정밀 조정, Pretendard preconnect, llms.txt
- `7b838617` — 세션70-2: 블로그 목록 가입CTA, FontSizeControl 통합
- `d260eaa9` — 세션70: 글씨크기 상향, 가독성 개선, 화이트모드, 블로그CTA, 통계자료실

## 세션 70 전체 성과 (커밋 5건, 파일 28+개)

### 글씨 크기 시스템 전면 재설계 ✅
- 기본값(`:root`) = 기존 "크게" 수준 (fs-base: 16→18px)
- 작게=기존 보통, 크게=새 대형 스케일 (15/17/20/21/24/28/36)
- 간격 시스템 동기화 (btn-h 46px, card-p 16px, touch-min 46px)
- 모바일/데스크탑/태블릿 반응형 오버라이드 전부 갱신
- FontSizeControl: 구식 CSS변수 → class기반 통합

### 전체 가독성 대폭 개선 ✅
- text-primary: #E8EDF5 → #F2F5FA (+밝기)
- text-secondary: #94A8C4 → #B8CCDF (+25%)
- text-tertiary: #6B82A0 → #8BA3C0 (+밝기)
- border: #1A2A4A → #1E3258 (+가시성)
- bg-surface: #0C1528 → #0D1730 (카드 구분감 ↑)
- 블로그 본문: text-secondary → text-primary (opacity 0.92)
- 모든 액센트 컬러 밝기 +10%

### 화이트(라이트) 모드 추가 ✅
- `html.theme-light` 완전 CSS 변수 시스템 (60+ 변수)
- ThemeProvider: useTheme() + toggleTheme() + localStorage
- 라이트모드 정밀 보완: 스크롤바/블로그본문/코드/테이블/호버/드롭다운
- dark 클래스 충돌 방지, 헤더/탭바 배경 자동 전환

### 블로그 회원가입 CTA 3종 + 읽기 게이트 ✅
- BlogTopBanner: 상단 배너 (닫기 가능)
- BlogMidCTA: 본문 후 카테고리별 맞춤 카드
- BlogFloatingCTA: 스크롤 25% 플로팅 배너
- 블로그 목록 /blog 첫 페이지 가입유도 배너
- BlogReadGate: 비로그인 하루 3편 → 4편째 가입 유도 (SEO 봇 전체본문)

### 통계 자료실 신규 ✅
- `/apt/data`: 부동산 통계 (17시도 지역별 + CSV 3종 + 부산 39단지 특별자료)
- `/stock/data`: 주식 통계 (마켓별 + CSV 3종)
- CSV API 6종: apt-subscription/unsold/complex, stock-prices/sectors/history
- `public/data/busan-apt-pricing-2024-2025.csv`: 부산 24~25년 분양가
- DataCatalog JSON-LD + 풀 OG/SEO 메타

### 더보기 메뉴 재설계 ✅
- 4개 카테고리 그룹: 투자 정보 / 주식 / 부동산 / 설정
- 테마 전환 버튼 (다크↔라이트)
- 통계 자료실 링크 추가

### SEO/성능 갱신 ✅
- sitemap: /apt/data, /stock/data 추가
- robots.txt: data 경로 Allow
- Google Font(Inter) 제거 → Pretendard CDN 단일화
- cdn.jsdelivr.net preconnect 추가 (폰트 LCP ↑)
- llms.txt: 신규 페이지/기능 반영
- 가이드북: 화이트 모드/통계 자료실 설명 추가

### 어드민 ✅
- 릴리즈노트 세션70 (9개 항목)

## 크론 현황 (총 95개)
변경 없음

## PENDING
- [ ] 토스 심사: 결제경로 스크린샷 4장 캡처 → 이메일 첨부 발송
- [ ] 호스팅어 WordPress 자동발행 비활성화 (hPanel에서 직접)
- [ ] KIS_APP_KEY / FINNHUB_API_KEY
- [ ] 통신판매업 신고
- [ ] Phase 4: 주간 뉴스레터
- [ ] Lighthouse 성능 프로파일링
- [ ] 화이트 모드 실제 화면 미세 조정

## 아키텍처 규칙 (13개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선 13. DB 신규 컬럼 접근 시 (sb as any).from() 패턴 필수
