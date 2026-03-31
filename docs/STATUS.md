# 카더라 STATUS.md — 세션 65 완료 (2026-04-01 09:00 KST)

## 최신 커밋
- `55180bf` — 비로그인 가입 유도 팝업 2종 (SignupNudge)
- `6650038` — daily-report-snapshot 504 수정 (120s + 5병렬)
- `e9a6464` — 어드민 팝업 섹션 운영 현황 패널
- `66c38db` — 팝업 광고 관리 시스템 풀스택
- `adbbcc7` — Search Console image-sitemap + robots.txt 정리
- `1c75bf6` — 바이럴 인프라 공유 시스템 v2

## 세션 65 전체 성과 (60+ 커밋)

### 가입 유도 시스템 (신규)
- **SignupNudge 웰컴 팝업**: 첫 방문 1.5초 후 (소개 + 3대 혜택 + 카카오 CTA)
- **SignupNudge 탐색 팝업**: 서로 다른 URL 5개+ 방문 시 (KPI + 추가 기능 + 카카오 CTA)
- 24시간 쿨다운 + 세션당 1회 + GuestNudge 병행

### 팝업 광고 관리 시스템
- DB: popup_ads (title/content/image/link/display_type/target_pages/기간/CTR)
- 어드민 UI: CRUD + KPI + 운영 현황 패널
- 프론트: PopupAdManager (모달/배너/토스트 + localStorage)

### 바이럴 인프라
- ShareButtons v2: 카카오/밴드/X/페이스북/링크복사 + UTM + 공유횟수
- 7개 페이지 CTA + RightPanel 초대 배너

### 주식/리포트/유료상품
- 지수 KPI 6열 + 글로벌 지표 7개
- 데일리 리포트 지수/환율 + 공유 CTA
- 프로 ₩24,900 (비공개)

### 버그 수정 (9건)
- 가짜 접속자→실제 / CSS 2건 / sync 타임아웃 / blog-publish UUID
- daily-report-snapshot 504 / UnsoldApt 타입 5필드
- Search Console image-sitemap 438 에러 / 등락률·시간외

### 어드민
- 릴리즈 노트: 가입유도+팝업관리+공유v2+SearchConsole 반영
- 공유7d HealthBadge + 📢 팝업 관리 섹션

## 가입 유도 시스템 전체 현황
| 시스템 | 대상 | 시점 | 형태 |
|--------|------|------|------|
| SignupNudge 웰컴 | 첫 방문자 | 즉시 (1.5초) | 모달 |
| SignupNudge 탐색 | 5페이지+ 탐색 | 세션 중 1회 | 모달 |
| GuestNudge | 5일+ 재방문 | 단계적 | 토스트→배너→모달 |
| PromoSheet | 로그인+미설치 | 자동 | 바텀시트 |
| InstallBanner | PWA 미설치 | 자동 | 상단 배너 |
| NoticeBanner | 전체 | DB 관리 | 마퀴 배너 |
| PopupAdManager | 어드민 설정 | DB 관리 | 모달/배너/토스트 |

## PENDING
- [ ] Anthropic 크레딧 충전 (최우선)
- [ ] 토스페이먼츠 API 키
- [ ] KIS_APP_KEY 발급
- [ ] 통신판매업 신고
- [ ] Google/Naver 수동 URL 제출
- [ ] Search Console 오류 사이트맵 삭제

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선
