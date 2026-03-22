# 카더라 프로젝트 현황 (STATUS.md)

> **마지막 업데이트:** 2026-03-22 (세션 17 종료 시점)
> **최신 커밋:** `422cd6e` → 배포 `dpl_GmhTQ8YX` (READY ✅)

---

## 프로젝트 기본 정보

| 항목 | 값 |
|------|-----|
| 앱 URL | https://kadeora.app |
| 스택 | Next.js 15 App Router + Supabase Pro(서울) + Vercel Pro |
| Supabase project_id | `tezftxakuwhsclarprlz` (ap-northeast-2) |
| Vercel team_id | `team_oKdq68eA7PwgcxFs61wGPZ7j` |
| Vercel project_id | `prj_2nDcTjEcgAEew1wYdvVF57VljxJQ` |
| GitHub | wls9205-a11y/kadeora (main, public) |
| 도메인 | kadeora.app |
| 앱 성격 | 금융·부동산 정보 커뮤니티 (주식, 청약, 미분양, 재개발, 실거래가, 커뮤니티, 블로그) |

---

## 사이트 상태

| 페이지 | 상태 | title |
|--------|------|-------|
| /feed | ✅ 200 | 피드 \| 카더라 |
| /stock | ✅ 200 | 실시간 주식 시세 \| 카더라 |
| /apt | ✅ 200 | 아파트 청약 일정 \| 카더라 |
| /discuss | ✅ 200 | 토론 \| 카더라 |
| /blog | ✅ 200 | 블로그 — 주식·청약·부동산 정보 \| 카더라 |
| sitemap.xml | ✅ 1,261개 URL |
| robots.txt | ✅ /blog/ Allow 포함 |
| JSON-LD | ✅ 전 페이지 WebApplication 스키마 |
| 다크모드 | ✅ CSS 변수 기반, 하드코딩 0건 |
| 글씨 크기 | ✅ CSS 변수(--fs-xs ~ --fs-2xl) + font_size_preference 서버 저장 |
| RLS | ✅ 전 테이블 적용 |
| 사업자 정보 | ✅ 전 페이지 278-57-00801 |
| not-found | ✅ 커스텀 404 |

---

## DB 현황

| 테이블 | 건수 | 비고 |
|--------|------|------|
| blog_posts | 2,055 | 전부 is_published=true, 평균 1,827자, 12개월 분산 |
| stock_quotes | 249 | is_active=false 99건 (price=0) |
| apt_subscriptions | 106 | 만료분 status='closed' |
| redevelopment_projects | 945 | stage='조사 중' (기존 '기타' 전환) |
| posts (커뮤니티) | 3,741 | 카테고리 한글→영문 통일 완료 |
| profiles | 111 | 아바타 fallback 구현됨 |
| blog_quality_rules | 20 | 품질 게이트 규칙 |
| blog_builder_registry | 8 | 빌더 함수 등록 |
| unsold_monthly_stats | 204 | 17시도 × 12개월 (2025-04 ~ 2026-03) |
| apt_watchlist | — | item_id: UUID → TEXT (bigint/uuid 모두 수용) |

### 블로그 품질 게이트

DB 트리거 `trg_blog_quality_gate` → `validate_blog_post()` (INSERT/UPDATE 시 자동 실행)
- 필수 필드 9개 (title 10~80자, content 800자+, slug, excerpt, meta 등)
- SEO 품질 5개 (내부 링크, FAQ, 목차, 지도 링크, cover_image)
- 스팸 방지 6개 — INSERT에만 적용 (중복 title/slug, 일/시간 제한, 비교글 20% 이하)

### 블로그 빌더 RPC

| 빌더 | 함수 | 상태 |
|------|------|------|
| 주식 일일 시황 | `build_stock_daily_blog(p_date)` | ✅ 구현됨 |
| 청약 신규 소식 | `build_subscription_blog(p_house_manage_no)` | ✅ 구현됨 |
| 주식 종목 분석 | `generate_stock_analysis_blog` | 빌더 전환 필요 |
| 실거래 아파트 분석 | `generate_apt_trade_blog` | 빌더 전환 필요 |
| 미분양 단지 분석 | `generate_unsold_blog` | 빌더 전환 필요 |
| 재개발 프로젝트 | `generate_redev_project_blog` | 빌더 전환 필요 |
| 주식 테마 분석 | `generate_stock_theme_blog` | 빌더 전환 필요 |
| 주식 섹터 분석 | `generate_stock_sector_blog` | 빌더 전환 필요 |

---

## 미해결 사항 (TODO)

### 관리자 수동 작업
- [ ] Google Search Console — sitemap 제출 (`/sitemap.xml`)
- [ ] 네이버 서치어드바이저 — sitemap 제출
- [ ] 토스 라이브키 교체 — Vercel 환경변수에서 `test_` → `live_`
- [ ] Supabase Vanity URL — `NEXT_PUBLIC_SUPABASE_URL`을 `kadeora.supabase.co`로 변경
- [ ] VAPID 키 생성 + 등록 (푸시 알림 활성화)

### 코드 작업
- [ ] 부산 재개발 근본 수정 — 월요일 크론 실행 후 `cron_logs` metadata에서 API 필드명 확인 → 매핑 수정
- [ ] `stock_quotes` 99개 price=0 — KIS API 등 실시간 데이터 소스 연동 필요
- [ ] 주식 목록 각 종목 카드에 ⭐ 관심종목 토글 버튼 추가 (상세 페이지에만 있음)
- [ ] 지역별 평균 거래가 추이 차트 — 구 탭 클릭 연동 동작 확인
- [ ] 어드민 대시보드 7일 추이 차트 — 데이터 없어서 빈 상태

### 블로그 시스템
- [ ] 크론을 블로그 빌더 RPC로 전환 — 직접 INSERT → RPC 호출 방식
- [ ] 나머지 6개 빌더 함수 구현
- [ ] robots.txt CDN 캐시 갱신 확인
- [ ] sitemap 캐시 갱신 확인 (블로그 2,055건 전부 등재 여부)
- [ ] 크론 에러 확인 (blog-daily, blog-seed-guide 다음 실행 시)

---

## 최근 세션 이력

| 세션 | 날짜 | 주요 작업 | 배포 |
|------|------|----------|------|
| 16 | 2026-03-21~22 | 블로그 시드 26K→삭제→2,055건, 품질 게이트, 빌더 RPC, 전수조사 수정 | 다수 |
| 17 | 2026-03-22 | 부동산 UI 대폭 개선, 글씨 크기 CSS 변수, title 중복, SEO, 어드민 버그 | 8회 |

상세 내용: `docs/sessions/session-16.md`, `docs/sessions/session-17.md` 참조

---

## 알려진 이슈 / 주의사항

- **두 컴퓨터 동시 작업 시** ThemeToggle import 오류로 사이트 다운된 전적 있음 (세션 16). 동시 푸시 시 서로의 작업 내용 확인 필수.
- **AptClient.tsx** 인라인 fontSize 102건 CSS 변수 교체 완료 (세션 17). 나머지 컴포넌트도 인라인 스타일 남아있을 수 있음.
- **stock_quotes** is_active=false 99건은 UI에서 숨겨져 있지만 DB에는 남아있음.
