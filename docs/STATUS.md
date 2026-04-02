# 카더라 STATUS.md — 세션 70 최종 (2026-04-03 KST)

## 최신 커밋
- `90ac9a91` — 세션70-6: font-size 스케일링 버그 수정 + 네비/블로그 CSS변수 전환
- `42bbd7b8` — 세션70-5: Excel/CSV 다운로드, 부산CSV 삭제, 인라인 font-size 스케일링
- `793832c7` — STATUS.md 세션70 최종
- `85b7078d` — 세션70-4: 가이드북 갱신
- `33867f7f` — 세션70-3: 라이트모드 정밀 조정, preconnect
- `7b838617` — 세션70-2: 블로그 목록 가입CTA, FontSizeControl 통합
- `d260eaa9` — 세션70: 글씨크기 상향, 가독성, 화이트모드, CTA, 통계자료실

## 세션 70 전체 성과 (커밋 8건, 파일 35+개)

### 글씨 크기 시스템 전면 재설계 ✅
- 기본값 = 기존 "크게" (fs-base 16→18px)
- 작게=기존보통, 크게=새 대형 스케일
- **ROOT 레벨 인라인 font-size 스케일링**: `font-size: 9~15px` 자동 +2~3px
- font-large: +4~5px, font-small: -2~3px 추가 스케일
- CSS 선택자 버그 수정: React DOM `font-size: 13px` (공백 포함) 매칭
- Navigation/Blog h1: 하드코딩 → var(--fs-xs)/var(--fs-sm)/var(--fs-xl)
- FontSizeControl: 구식→클래스 기반 통합

### 전체 가독성 대폭 개선 ✅
- text-primary +밝기, text-secondary +25%, text-tertiary +밝기
- border +가시성, bg-surface +카드구분감
- 모든 액센트 컬러 +10%
- 블로그 본문: text-primary (opacity 0.92)

### 화이트(라이트) 모드 ✅
- 완전 CSS 변수 시스템 (60+ 변수)
- ThemeProvider: useTheme() + toggleTheme()
- 정밀 보완: 스크롤바/블로그/코드/테이블/호버/오버레이/주식시세 색상
- dark 클래스 충돌 방지

### 블로그 CTA + 읽기 게이트 ✅
- BlogTopBanner/BlogMidCTA/BlogFloatingCTA (3종)
- 블로그 목록 가입 배너
- BlogReadGate: 비로그인 하루 3편 (Node 커밋)

### 통계 자료실 ✅
- `/apt/data` + `/stock/data`: Excel(xlsx)/CSV 듀얼 다운로드
- xlsx 패키지 + data-export 유틸
- CSV API 6종 → ?format=xlsx|csv 파라미터 지원
- DataCatalog JSON-LD + OG/SEO 완비

### 더보기 메뉴 ✅
- 4카테고리 그룹 + 테마전환 버튼 + 통계자료실 링크

### SEO/성능 ✅
- sitemap/robots/llms.txt 갱신
- Google Font 제거 → Pretendard 단일화
- cdn.jsdelivr.net preconnect
- 가이드북 신기능 추가

## 크론 현황 (총 95개)
변경 없음

## PENDING
- [ ] 토스 심사: 결제경로 스크린샷 → 이메일
- [ ] KIS_APP_KEY / FINNHUB_API_KEY
- [ ] 통신판매업 신고
- [ ] Lighthouse 성능 프로파일링
- [ ] 화이트 모드 실제 화면 미세 조정

## 아키텍처 규칙 (13개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선 13. (sb as any).from() 필수
