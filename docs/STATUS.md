# 카더라 STATUS.md — 세션 70 최종 (2026-04-03 KST)

## 최신 커밋
- `95834765` — 세션70-7: 주식 비교/새로고침 삭제, 분양사이트 삭제, 더보기 뒤로가기, 메가폰 라이트모드
- `90ac9a91` — 세션70-6: font-size 스케일링 버그 수정 (React DOM 공백 매칭)
- `42bbd7b8` — 세션70-5: Excel/CSV 다운로드, 부산CSV 삭제
- `d260eaa9` — 세션70: 글씨크기 상향, 가독성, 화이트모드, CTA, 통계자료실

## 세션 70 전체 성과 (커밋 10건, 파일 40+개)

### UI 수정 ✅
- 주식 페이지: 비교/새로고침 버튼 삭제 → 공유 버튼만 유지 (타 페이지 정렬 통일)
- 부동산 페이지: 지역별 현황에서 분양사이트 카드 삭제
- 더보기 시트: 좌상단 ← 뒤로가기 버튼 + '더보기' 타이틀 헤더

### 글씨 크기 시스템 ✅
- 기본값 = 기존 "크게" (fs-base 16→18px)
- ROOT 레벨 인라인 font-size 스케일링: 9~15px 자동 +2~3px
- CSS 버그 수정: React DOM `font-size: 13px` (공백 포함) 매칭
- Navigation/Blog h1: 하드코딩 → CSS변수 전환

### 가독성 + 다크/라이트 모드 ✅
- text-primary/secondary/tertiary +15~25% 밝기
- 화이트 모드: 60+ CSS변수 + ThemeProvider
- 메가폰/NoticeBanner: 라이트모드 배경/텍스트 가시성 보정
- 오버레이 투명도, 주식 시세 색상 대비 강화

### 블로그 CTA + 읽기 게이트 ✅
- CTA 3종 + 목록 배너 + 하루 3편 읽기 게이트

### 통계 자료실 ✅
- Excel(.xlsx) + CSV 듀얼 다운로드 (xlsx 패키지)
- API 6종 ?format=xlsx|csv 지원

### 네이버 시총 크롤링 확대 ✅
- stock-discover: 2페이지→4페이지 (200종목/마켓, 시총 100위 확실 커버)

### SEO/성능 ✅
- sitemap/robots/llms.txt, Pretendard preconnect, Google Font 제거

## 크론 현황 (총 95개)
변경 없음

## PENDING
- [ ] KIS_APP_KEY / FINNHUB_API_KEY
- [ ] 통신판매업 신고
- [ ] Lighthouse 프로파일링

## 아키텍처 규칙 (13개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선 13. (sb as any).from() 필수
