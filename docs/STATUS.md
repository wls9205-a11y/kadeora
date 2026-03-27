# 카더라 프로젝트 STATUS — 세션 40~42 (2026-03-27 KST)
> 풀스택 전수 조사 + 주식/부동산 강화 + 보안/SEO/코드품질 개선 + 어드민 대시보드 진화
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 최종 스코어카드

| 항목 | 세션 시작 | 세션 완료 | 변화 |
|------|----------|----------|------|
| **as any 캐스트** | 98건 | **74건** | **-24 (24%↓)** |
| **ignoreBuildErrors** | `true` | **`false`** | **tsc 빌드 에러 → 배포 차단** |
| **globals.css** | 1,296줄 단일 | **4파일 분할** | 368+133+162+633 |
| **사이트맵** | 단일 파일 | **인덱스 분할 (6+세그먼트)** | 50k URL 대비 |
| **섹터 SEO 페이지** | 없음 | **14개 신규** | `/stock/sector/[name]` |
| **보안** | KAKAO 키 하드코딩 | **환경변수 전용** | |
| **SEO** | llms.txt 없음 | **llms.txt + robots.txt 참조** | |
| **크론 수정** | flow/news 0건 | **haiku + 에러 로깅** | |
| **진단 페이지** | 75줄 (가점만) | **174줄 (전략/커트라인/팁)** | |
| **주식 페이지네이션** | 50건 고정 | **30건 + 더보기** | |
| **통합 검색** | 없음 | **5탭 동시 필터 + 매칭 건수** | |
| **대시보드** | 254줄 | **358줄 (자동새로고침/크론상세/인기페이지)** | |
| **tsc --noEmit** | 0건 | **0건 유지** | |
| **프로덕션 에러** | — | **0건** | |

## 세션 42 작업 (2026-03-27) — 카더라 커밋 8건+

### 공유 버튼 전수조사 + 수정 [COMPLETED]
- **핵심 버그 수정:** ShareButtons URL이 항상 `/feed/{postId}`로 고정 → 부동산/주식/블로그에서 404 공유됨
- `window.location.href`로 변경하여 현재 페이지 URL 정확히 공유
- 모바일에서 네이티브 공유 시트(📤) 최우선 표시
- `postId` prop → optional 변경 (6개 파일 수정)
- 프로필 공유에 네이티브 공유 추가
- CSP form-action에 googletagmanager 추가 (콘솔 에러 해결)

### 시군구 수집 강화 [COMPLETED]
- InterestRegistration.tsx: 시도 선택 → 시군구 드롭다운 자동 표시 + 유효성 검사
- interest API: 회원 원클릭 등록 시 profiles에서 residence_district 자동 사용
- ProfileHeader.tsx: 프로필 편집에서 시군구 선택/수정 가능

### 어드민 관심단지 관리 [COMPLETED]
- /api/admin/interests: 단지별 관심 수 집계 + 고객 목록 조회
- realestate.tsx: 관심단지 탭 — 단지별 카드 목록, 회원/비회원 분리, CSV 다운로드

### 어드민 13가지 풀스택 진화 (ebdf37d) [COMPLETED]
| # | 개선 | 파일 |
|---|------|------|
| 1 | 숨겨진 3페이지 MissionControl 통합 | notices.tsx, system.tsx, reports.tsx |
| 2 | 환경변수 체크 UI | system.tsx → 🔑 환경변수 탭 |
| 3 | 푸시 알림 관리 | notices.tsx → 📣 발송+이력 |
| 4 | 실시간 활동 피드 | dashboard.tsx → 가입/글/댓글/신고 시간순 |
| 5 | 검색어 트렌드 | analytics.tsx → 인기 검색어+콘텐츠 갭 |
| 6 | 공유 분석 | analytics.tsx → 플랫폼별 공유 비율 |
| 7 | 유저 피드백 | FeedbackButton.tsx + /api/feedback |
| 8 | 기능 플래그 토글 | system.tsx + /api/admin/feature-flags |
| 9 | 콘텐츠 인사이트 | analytics.tsx 인사이트 탭 통합 |
| 10 | 주식/초대 현황 | 인사이트 패널 통합 |
| 11 | 초대 시스템 현황 | 총 초대 수 + 초대왕 Top 5 |
| 12 | 상점 관리 | shop.tsx + /api/admin/shop |
| 13 | GOD MODE 57크론 | 42→57개 (15개 누락 추가) |

**MissionControl 사이드바:** 11개 → 13개 섹션 (📢 공지·알림, 🛍️ 상점 추가)

**신규 파일 8개:**
- sections/notices.tsx, sections/shop.tsx
- api/admin/feature-flags, notices, push-stats, shop, interests
- api/feedback, components/FeedbackButton.tsx

### 위성 API User-Agent 수정 (0ab303e) [COMPLETED]
- 호스팅어가 Vercel IP를 봇으로 차단하는 문제 → User-Agent 헤더 추가
- 타임아웃 5초→10초, expired 판단 문구 특정, httpCode/error 필드 추가

## 세션 41 커밋 이력

| # | SHA | 내용 | 파일 |
|---|-----|------|------|
| 1 | `2839da8` | any 476→305, 크론 504, Edge 캐시 +5, errMsg 유틸 | 82 |
| 2 | `a97fe1b` | 'use client' 지시어 순서 핫픽스 | 4 |
| 3 | `e9e05ca` | UX 전수조사 — 딥링크, 푸터, 404, 주소, 이미지 | 4 |
| 4 | `9b6559f` | select('*') 23→19 + STATUS.md | 4 |
| 5 | `ccc349e` | 어드민 API try/catch 12개 + loading/error 20개 + A11y | 35 |
| 6 | `8ce5b04` | any 추가 제거, select 추가 최적화, auth 5건, CSS 유틸 | 21 |
| 7 | `7d17854` | auth 전환 9곳 + 어드민 requireAdmin 통일 | 6 |
| 8 | `c4239ad` | AuthProvider 프로필 확장 + any 278→253 + Edge 캐시 | 16 |
| 9 | `3b6d078` | Navigation/Sidebar/RightPanel → useAuth() 전환 완료 | 4 |
| 10 | `491b569` | 크론 12개 try/catch + 보안 헤더 5종 + SEO 메타 2곳 + maxDuration 5곳 | 20 |
| 11 | `194dd65` | 미사용 import 정리 | 2 |
| 12 | `9ac2027` | **재개발 탭 '수집 중' 버그 수정** — blog_slug 없는 컬럼 제거 | 1 |
| 13 | `f2c8fde` | **UI 레이아웃 변경 3곳** — 주식 시세바, 청약 캘린더, 분양중 요약 | 3 |
| 14 | `8bdb8e9` | as any 10건 → narrower type assertion | 2 |
| 15 | `2027663` | maxDuration 상향 3곳 — apt/[id] 60초, sync 300초, series 120초 | 3 |

## 핵심 아키텍처 변경

### AuthProvider 프로필 확장
- `userId` → `profile` (nickname, grade, points, fontSizePref, isAdmin) + `refreshProfile()`
- 12개 컴포넌트가 개별 auth 호출하던 패턴 완전 제거
- 페이지 로드 시 Supabase auth 요청 ~10회 → 1회

### UI 레이아웃 변경 (스크린샷 기반)
- 주식: 시세 요약 바 → KR/US 탭 위로 이동
- 청약: 캘린더 → 목록 아래로 이동
- 분양중: 입주임박/분양현황/진행단계 → 목록 아래로 이동

### 재개발 탭 버그 수정
- 원인: select('*') 최적화 시 blog_slug(존재하지 않는 컬럼) 추가 → 쿼리 실패
- 수정: blog_slug 제거 + RedevTab이 사용하는 22개 컬럼 명시

## 보안 현황 (9종 헤더 프로덕션 확인 완료)
- Content-Security-Policy (CSP)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- X-Frame-Options: DENY
- X-DNS-Prefetch-Control: on
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-origin
- X-Permitted-Cross-Domain-Policies: none

## 남은 장기 과제
- [ ] any 253건 → 200건 이하 (Supabase 타입 시스템 한계)
- [ ] StockClient 인라인 스타일 136개 → CSS 유틸 전환
- [ ] 테스트 커버리지 확대 (현재 6개)
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY 발급 (한국투자증권)

## 호스팅어 위성 네트워크 (세션 40 — 2026-03-26)

### 인프라 완성 (3라운드, 29작업)
| 항목 | 분양권실전투자 | 급매물 | 주린이 |
|------|:---:|:---:|:---:|
| mu-plugins 7+ | ✅ | ✅ | ✅ |
| favicon + manifest | ✅ 200 | ✅ 200 | ✅ 200 |
| Article + BreadcrumbList Schema | ✅ | ✅ | -(만료) |
| 네이버 메타태그 | ✅ | ✅ | -(만료) |
| image-sitemap | ✅ 200 | ✅ 200 | ✅ 200 |
| robots.txt AI봇 허용 | ✅ | ✅ | -(만료) |
| llms.txt | ✅ 200 | ✅ 200 | ✅ 200 |
| 이미지 ALT 보강 | 245개 | 109개 | 2개 |
| .htaccess 캐싱/압축 | ✅ | ✅ | ✅ |
| 내부링크 | ✅ | ✅ | - |

### 딥링크 포스트 18편 발행
| 사이트 | 포스트 | ID 범위 | 딥링크 대상 |
|--------|--------|---------|-------------|
| 분양권실전투자 | 6편 | 33821~33826 | /apt 청약, 래미안, 블로그, 검색, 힐스테이트 |
| 급매물 | 6편 | 14300~14305 | /apt/search, 실거래, 재개발, 미분양 |
| 주린이 | 6편 | 497~502 | /stock/삼성전자, SK하이닉스, 비교, 카카오 |

### 자동화 시스템 (mu-plugin)
- kd_deeplink_injector.php — RSS 자동 포스트 33%에 카더라 딥링크 삽입 (키워드 매칭, 5가지 스타일 랜덤)
- kd_structure_rotation.php — 매주 월요일 크론, 30일+ 포스트 5개 앵커/스타일/위치 변경 (다음: 4/2)

### 카더라 어드민 MissionControl (13개 섹션)
- 📊 대시보드 (KPI + 트렌드 + 실시간 활동 피드)
- 📈 방문자 (히트맵 + 유입경로 + 💡 인사이트: 검색어 트렌드/공유 분석)
- 🔍 SEO · 점수
- 👤 유저 관리 (검색/필터/정지/삭제/포인트)
- 📝 콘텐츠 (게시글/댓글/토론/채팅)
- ✍️ 블로그 (8종 크론 실행)
- 🏢 부동산 (현장/청약/미분양/재개발/관심단지)
- ⚙️ 시스템 (크론 + 🔑 환경변수 + 🖥️ 인프라 + 🚩 기능 플래그)
- 🚨 신고/결제 (신고 처리 + 💳 결제 내역)
- 📢 공지 · 알림 (site_notices + 📣 푸시 브로드캐스트)
- 🛍️ 상점 (상품 관리 + 주문 내역)
- 🛰️ 위성 네트워크 (3사이트 상태 + SEO + IndexNow)
- ⚡ GOD MODE (57개 크론 배치 실행)

### mu-plugin 총 현황 (8개 × 3사이트 = 24파일)
1. kd_rss_sync.php — RSS 자동 파이프라인 (6시간 간격)
2. kd_schema_markup.php — Article + BreadcrumbList 구조화 데이터
3. kd_naver_meta.php — 네이버/다음/카카오 전용 메타태그
4. kd_image_sitemap.php — 이미지 사이트맵
5. kd_og_fallback.php — OG 이미지 카더라 API 폴백
6. kd_favicon.php — 파비콘 head 태그 + theme-color + manifest
7. kd_deeplink_injector.php — RSS 딥링크 자동 삽입 (33%)
8. kd_structure_rotation.php — 주간 구조 로테이션 크론 (다음: 4/2)

### 사이트 총 현황
- 분양권실전투자: 8,675편 (포스트)
- 급매물: 3,513편
- 주린이: 41편 (🚨 도메인 만료!)

### 주의사항
- stockcoin.net 절대 카더라 연결 금지 (스팸 연좌제)
- 106개 기타 사이트 크로스링크 전수 제거 완료, 다시 추가 금지
- 딥링크 삽입률: 33% (3편 중 1편) — 과도하면 PBN 탐지
- 구조 로테이션: 30일+ 포스트만, 한번에 5개, 매주 월요일
- blog-auto-link.ts: EXTERNAL_KEYWORDS 6개 (nofollow, 포스트당 1개)
- **호스팅어 사업자 정보 제거 필요** — 프롬프트 준비됨 (다음 세션 실행)
- **stockcoin.net GA 제거 필요** — SSH + GA 콘솔 2곳

## PENDING 수동 작업
- [ ] **토스 정산 등록 (3/31 마감 D-4!)**
- [ ] **주린이.site 도메인 갱신** (만료!)
- [x] ~~호스팅어 플랜 갱신~~ ✅ 완료
- [ ] **호스팅어 사업자 정보 제거** (프롬프트 준비됨: claude-code-remove-business-info.md)
- [ ] **stockcoin.net GA 추적 코드 제거** (프롬프트 준비됨: claude-code-stockcoin-ga-remove.md)
- [ ] 구글 서치콘솔에 분양권실전투자.com 등록 + 사이트맵 제출
- [ ] 네이버 서치어드바이저 3사이트 RSS/사이트맵 제출
- [ ] Bing 웹마스터 3사이트 인증코드 교체
- [ ] 급매물 "123" 관리자 계정 비밀번호 강화
- [ ] 분양권실전투자 1MB+ 이미지 581개 압축
- [ ] WP 플러그인 8개 업데이트
- [ ] GA 콘솔에서 stockcoin.net 데이터 스트림/크로스 도메인 제거 (수동)

## 준비된 클로드 코드 프롬프트 (다음 세션용)
- `claude-code-remove-business-info.md` — 호스팅어 사업자 정보 완전 제거
- `claude-code-stockcoin-ga-remove.md` — stockcoin.net GA 추적 코드 제거
- `claude-code-admin-evolution.md` — 어드민 13가지 진화 (실행 완료)

## ⚠️ 긴급
- **토스 정산 등록 3/31 마감 (D-4)** — 수동 처리 필요
- **주린이.site 도메인 만료** — 호스팅어 hPanel에서 갱신
