# 카더라 프로젝트 STATUS — 세션 40+41 (2026-03-27 KST)
> 호스팅어 위성 네트워크 완성 + 딥링크 18편 + 어드민 위성 탭 + 자동화 크론
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 최종 스코어카드

| 항목 | 세션 시작 | 세션 완료 | 변화 |
|------|----------|----------|------|
| **any 타입** | 476건 | **253건** | **-223 (47%↓)** |
| **as any 캐스트** | ~120건 | **93건** | **-27** |
| **select('*')** | 23건 | **11건** | **-12 (52%↓)** |
| **Edge 캐시 API** | 7개 | **11개** | **+4** |
| **auth 직접 호출** | 12곳 | **0곳** | **100% useAuth 전환** |
| **크론 try/catch** | 24개 누락 | **전부 추가** | 0개 누락 |
| **어드민 try/catch** | 12개 누락 | **전부 추가** | |
| **어드민 loading/error** | 0 | **20개** | |
| **어드민 requireAdmin** | 5 인라인 | **전부 통일** | |
| **보안 헤더** | 4종 | **9종** | +5종 |
| **접근성** | aria 누락 | **5곳 수정** | |
| **SEO 메타데이터** | 누락 2곳 | **layout 추가** | apt/diagnose, stock/compare |
| **maxDuration** | 미설정 | **8곳** | 타임아웃 방지 |
| **AuthProvider** | userId만 | **프로필 확장** | nickname/grade/points/isAdmin |
| **크론 504** | 반복 실패 | **0건** | maxDuration 상향 |
| **tsc --noEmit** | 0건 | **0건 유지** | |
| **console.log** | 0건 | **0건** | |
| **미사용 import** | 0건 | **0건** | |
| **프로덕션 에러(2h)** | — | **0건** | |

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

### 카더라 어드민 위성 네트워크 탭 (e341fc6)
- admin-shared.tsx: `satellite` Section 타입 + SECTIONS 배열 추가
- MissionControl.tsx: SatelliteSection dynamic import
- sections/satellite.tsx: 사이트 상태, SEO 체크리스트, 구조 로테이션 현황, 원클릭 액션
- api/admin/satellite/route.ts: 3사이트 HTTP 체크 + IndexNow Ping API

### mu-plugin 총 현황 (7개 × 3사이트 = 21파일)
1. kd_rss_sync.php — RSS 자동 파이프라인 (6시간 간격)
2. kd_schema_markup.php — Article + BreadcrumbList 구조화 데이터
3. kd_naver_meta.php — 네이버/다음/카카오 전용 메타태그
4. kd_image_sitemap.php — 이미지 사이트맵
5. kd_og_fallback.php — OG 이미지 카더라 API 폴백
6. kd_favicon.php — 파비콘 head 태그 + theme-color + manifest
7. kd_deeplink_injector.php — RSS 딥링크 자동 삽입 (33%)
8. kd_structure_rotation.php — 주간 구조 로테이션 크론

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

## PENDING 수동 작업
- [ ] **토스 정산 등록 (3/31 마감 D-4!)**
- [ ] **주린이.site 도메인 갱신** (만료!)
- [ ] **호스팅어 플랜 갱신** (20일 내 만료 경고!)
- [ ] 구글 서치콘솔에 분양권실전투자.com 등록 + 사이트맵 제출
- [ ] 네이버 서치어드바이저 3사이트 RSS/사이트맵 제출
- [ ] Bing 웹마스터 3사이트 인증코드 교체
- [ ] 급매물 "123" 관리자 계정 비밀번호 강화
- [ ] 분양권실전투자 1MB+ 이미지 581개 압축
- [ ] WP 플러그인 8개 업데이트

## ⚠️ 긴급
- **토스 정산 등록 3/31 마감 (D-4)** — 수동 처리 필요
- **주린이.site 도메인 만료** — 호스팅어 hPanel에서 갱신
- **호스팅어 플랜 20일 내 만료** — 갱신 필요
