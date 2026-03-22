# 카더라(kadeora.app) 프로젝트 지침서

> **최종 업데이트:** 2026-03-22 (세션 17 기준)
> **목적:** 어떤 세션/컴퓨터에서든 이 문서 하나로 카더라 웹앱의 전체 구조를 파악할 수 있도록 함

---

## 1. 프로젝트 개요

**카더라**는 한국 금융·부동산 정보 커뮤니티 웹앱입니다. 주식 시세, 아파트 청약, 미분양, 재개발, 실거래가 정보를 제공하고, 사용자들이 커뮤니티에서 소통할 수 있는 플랫폼입니다. 1인 개발 프로젝트입니다.

**서비스 URL:** https://kadeora.app

---

## 2. 기술 스택 & 인프라

| 구분 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 15 (App Router) | Node.js 24.x |
| DB / Auth | Supabase Pro | 서울 리전 (ap-northeast-2) |
| 호스팅 | Vercel Pro | kadeora.app 도메인 |
| 결제 | Toss Payments | 현재 test 키 (라이브 전환 필요) |
| GitHub | wls9205-a11y/kadeora | main 브랜치, public |
| PWA | 지원 | 28건 설치 이력 |

### 접속 정보

| 항목 | 값 |
|------|-----|
| Supabase project_id | `tezftxakuwhsclarprlz` |
| Vercel team_id | `team_oKdq68eA7PwgcxFs61wGPZ7j` |
| Vercel project_id | `prj_2nDcTjEcgAEew1wYdvVF57VljxJQ` |
| 사업자등록번호 | 278-57-00801 |

---

## 3. 주요 페이지 & 기능

### /feed — 커뮤니티 피드
- 사용자 게시글 목록 (카테고리: apt, stock, free 등)
- 좋아요, 댓글, 북마크, 공유
- 익명 게시 가능
- 해시태그, 주식 태그, 아파트 태그 지원
- 확성기(megaphone): 유료 상품으로 상단 고정 메시지
- 고정글(pinned_posts): 유료로 글 상단 고정

### /stock — 실시간 주식 시세
- KOSPI/KOSDAQ/NYSE/NASDAQ/ETF 종목 시세
- 5분 자동 갱신 (수동 새로고침 제거됨)
- 종목별 상세: 차트, 뉴스, 공시, AI 코멘트, 투자자 매매동향
- 종목 토론방 (discussion_rooms, stock_comments)
- 주식 테마/섹터 분류
- 원/달러 환율 헤더에 표시 (스파크라인 칩)

### /apt — 부동산 (청약, 미분양, 재개발, 실거래)
- **청약 캘린더:** 날짜 클릭 → 해당일 청약 단지 목록, 상세 페이지 링크
- **미분양:** 지역별 히트맵, 12개월 추이 차트, 상세 요약 카드
- **재개발:** 단계별 파이프라인, 숫자 클릭 필터, 한줄평 작성
- **실거래:** 74개 시군구 거래 데이터, 평당가 TOP10 차트
- ⭐ 관심단지 토글 (apt_watchlist, item_id는 TEXT 타입)
- 지역별 평균 거래가 추이 차트

### /discuss — 토론
- 찬반 투표(poll) 형태 토론 주제
- 댓글, 투표, 핫/고정 표시

### /blog — 블로그
- 2,055건 자동 생성 + 수동 가이드 글
- 카테고리: apt, stock, unsold, finance, general
- 12개월 분산 발행 (2025-04 ~ 2026-03)
- 품질 게이트 트리거로 최소 기준 보장
- 블로그 댓글(blog_comments) 지원
- SSR 렌더링, OG 이미지 자동 생성

### /admin — 관리자 대시보드 (is_admin=true 사용자만)
- KPI: 유저/게시글/댓글/블로그/페이지뷰/주식/청약/미분양/재개발/실거래 건수
- 7일 추이 차트 (데이터 미비)
- 크론 로그, 헬스 체크, API 쿼타 모니터링

---

## 4. DB 테이블 구조

### 사용자 & 인증

| 테이블 | 건수 | 설명 |
|--------|------|------|
| profiles | 111 | 사용자 프로필 (등급 1~10, 포인트, 프리미엄, 글씨 크기 설정 등) |
| notification_settings | 111 | 알림 설정 (댓글/좋아요/팔로우/청약/주식/일일요약 등) |
| attendance | 2 | 출석 체크 |
| user_streaks | 0 | 연속 로그인 |
| user_regions | 5 | 사용자 관심 지역 |
| push_subscriptions | 1 | 푸시 구독 |

### 커뮤니티

| 테이블 | 건수 | 설명 |
|--------|------|------|
| posts | 3,742 | 커뮤니티 게시글 (카테고리: apt/stock/free) |
| comments | 2,228 | 댓글 (대댓글 parent_id, 한줄평 comment_type='oneliner') |
| post_likes | 2,462 | 좋아요 |
| bookmarks | 721 | 북마크 |
| follows | 21 | 팔로우 |
| blocks | 0 | 차단 |
| reports | 1 | 신고 |
| notifications | 2,005 | 알림 |
| point_history | 3,585 | 포인트 내역 |

### 토론

| 테이블 | 건수 | 설명 |
|--------|------|------|
| discussion_rooms | 6 | 토론방 (stock/apt/theme) |
| discussion_messages | 30 | 토론방 메시지 |
| discussion_topics | 30 | 찬반 토론 주제 |
| discussion_votes | 1 | 투표 |
| discussion_comments | 0 | 토론 댓글 |

### 주식

| 테이블 | 건수 | 설명 |
|--------|------|------|
| stock_quotes | 249 | 종목 시세 (is_active=false 99건 = price=0) |
| stock_price_history | 495 | 가격 히스토리 |
| stock_themes | 8 | 테마 |
| stock_news | 32 | 종목 뉴스 |
| stock_ai_comments | 20 | AI 코멘트 |
| stock_investor_flow | 15 | 투자자 매매동향 |
| stock_disclosures | 50 | 공시 |
| stock_comments | 15 | 종목 토론 댓글 |
| stock_watchlist | 0 | 관심종목 |
| stock_daily_briefing | 3 | 일일 시황 |
| exchange_rates | 1 | 환율 |
| exchange_rate_history | 30 | 환율 히스토리 |

### 부동산 — 청약

| 테이블 | 건수 | 설명 |
|--------|------|------|
| apt_subscriptions | 106 | 청약 정보 (만료분 status='closed') |
| apt_competition_rates | 0 | 경쟁률 |
| subscription_schedules | 8 | 청약 일정 (수동 등록) |

### 부동산 — 미분양

| 테이블 | 건수 | 설명 |
|--------|------|------|
| unsold_apts | 203 | 미분양 단지 |
| unsold_apts_history | 179 | 미분양 시군구별 히스토리 |
| unsold_monthly_stats | 204 | 시도별 월간 통계 (17시도 × 12개월) |

### 부동산 — 재개발

| 테이블 | 건수 | 설명 |
|--------|------|------|
| redevelopment_projects | 945 | 재개발/재건축 현장 |
| redevelopment_zones | 45 | 재개발 구역 (랜드마크) |

### 부동산 — 실거래

| 테이블 | 건수 | 설명 |
|--------|------|------|
| apt_transactions | 1,492 | 아파트 실거래 |
| apt_trade_monthly_stats | 20 | 지역별 월간 거래 통계 |
| apt_resale_rights | 0 | 분양권 전매 |

### 부동산 — 공통

| 테이블 | 건수 | 설명 |
|--------|------|------|
| apt_watchlist | 0 | 관심단지 (item_id TEXT, 여러 타입 수용) |
| apt_comments | 1 | 아파트 한줄평 (house_type: sub/unsold) |
| apt_alerts | 0 | 청약 알림 |
| apt_notifications | 0 | 부동산 알림 |
| apt_bookmarks | 0 | 아파트 북마크 |
| apt_cache | 3 | 캐시 데이터 |
| landmark_apts | 120 | 랜드마크 아파트 |

### 블로그

| 테이블 | 건수 | 설명 |
|--------|------|------|
| blog_posts | 2,055 | 블로그 글 (품질 게이트 적용) |
| blog_comments | 0 | 블로그 댓글 |
| blog_quality_rules | 20 | 품질 게이트 규칙 (RLS 미적용) |
| blog_builder_registry | 8 | 빌더 함수 등록 (RLS 미적용) |
| guide_seeds | 118 | 가이드 글 시드 데이터 |

### 결제 & 상점

| 테이블 | 건수 | 설명 |
|--------|------|------|
| shop_products | 15 | 상점 상품 |
| purchases | 2 | 구매 내역 |
| payments | 0 | 결제 내역 (Toss) |
| shop_orders | 0 | 주문 |
| megaphones | 2 | 확성기 |
| pinned_posts | 0 | 고정글 |
| plans | 3 | 구독 플랜 |
| subscriptions | 0 | 구독 |
| invite_codes | 2 | 초대 코드 |

### 운영 & 모니터링

| 테이블 | 건수 | 설명 |
|--------|------|------|
| cron_logs | 63 | 크론 실행 기록 |
| health_checks | 7 | 헬스 체크 |
| api_quotas | 6 | API 쿼타 |
| admin_alerts | 31 | 관리자 알림 |
| daily_stats | 2 | 일일 통계 |
| page_views | 1,805 | 페이지뷰 |
| search_logs | 17 | 검색 기록 |
| banned_words | 17 | 금칙어 |
| business_info | 1 | 사업자 정보 |
| payment_policy | 1 | 결제 정책 |
| trending_keywords | 10 | 트렌딩 키워드 |

---

## 5. 주요 RPC 함수

### 블로그 빌더
- `build_stock_daily_blog(p_date)` — 주식 일일 시황 블로그 자동 생성
- `build_subscription_blog(p_house_manage_no)` — 청약 소식 블로그 자동 생성
- `validate_blog_post()` — 품질 게이트 트리거 함수 (20개 규칙)

### 블로그 생성 RPC (시드 생성용)
- `generate_stock_analysis_blog`, `generate_apt_trade_blog`, `generate_unsold_blog`
- `generate_redev_project_blog`, `generate_stock_theme_blog`, `generate_stock_sector_blog`
- `generate_floor_analysis_blog`, `generate_area_analysis_blog`, `generate_built_year_blog`
- `generate_dong_trade_blog`, `generate_sigungu_trade_blog` 등

### 사용자 & 커뮤니티
- `handle_new_user()` — 신규 가입 시 프로필/알림설정 자동 생성
- `award_points()` / `deduct_points()` — 포인트 관리
- `update_grade()` / `update_user_grade()` — 등급 업데이트
- `set_nickname()` / `check_nickname_available()` — 닉네임 관리
- `check_in_attendance()` — 출석 체크
- `search_posts()` — 게시글 검색 (pg_trgm)
- `calculate_hot_score()` — 인기글 점수

### 주식
- `get_stock_dashboard()` / `get_stock_market_summary()` — 주식 대시보드
- `snapshot_daily_stock_prices()` — 일일 주가 스냅샷
- `aggregate_trade_monthly_stats()` — 월간 거래 통계 집계

### 부동산
- `get_apt_dashboard()` / `get_apt_dashboard_stats()` — 부동산 대시보드
- `snapshot_monthly_unsold()` — 월간 미분양 스냅샷
- `increment_apt_view()` — 조회수 증가

### 관리자
- `get_admin_dashboard()` / `get_admin_dashboard_stats()` — 어드민 KPI
- `capture_daily_stats()` — 일일 통계 수집
- `get_db_stats()` — DB 통계

---

## 6. 크론잡 (API Routes)

크론은 Vercel의 `vercel.json` cron 설정 또는 외부 트리거로 실행됩니다.
실행 기록은 `cron_logs` 테이블에 저장됩니다.

| 크론 | 경로 | 주기 | 설명 |
|------|------|------|------|
| blog-daily | /api/cron/blog-daily | 매일 | 블로그 자동 발행 |
| blog-seed-guide | /api/cron/blog-seed-guide | 필요 시 | 가이드 시드 블로그 생성 |
| refresh-all | /api/cron/refresh-all | 주기적 | 전체 데이터 갱신 (maxDuration=60s) |
| 기타 | 다양한 /api/cron/* | 다양 | 주식/부동산/환율 등 데이터 수집 |

**주의:** 크론 에러 시 catch에서 반드시 200 반환 (재시도 루프 방지)

---

## 7. SEO & 메타

- **sitemap.xml:** 동적 생성, blog_posts limit 5000
- **robots.txt:** 3개 User-Agent에 `/blog/` Allow 포함
- **JSON-LD:** 전 페이지 WebApplication 스키마
- **title 규칙:** 각 페이지 자체 title + layout.tsx template이 `| 카더라` 자동 추가 (중복 금지)
- **OG 이미지:** `/api/og?title=...` 엔드포인트로 자동 생성
- **Google / Naver 인증:** 전 페이지 적용

---

## 8. UI/UX 시스템

### 다크모드
- CSS 변수 기반, 하드코딩 색상 0건
- `ThemeProvider` + `ThemeToggle` 컴포넌트 (default export 주의!)

### 글씨 크기
- CSS 변수: `--fs-xs`(10px) ~ `--fs-2xl`
- `html.font-large` / `html.font-small` 클래스로 전체 오버라이드
- 서버 저장: `profiles.font_size_preference` (small/medium/large)
- AptClient.tsx 인라인 fontSize 102건 CSS 변수 교체 완료

### 등급 시스템
- 1~10 등급 (`grade_definitions` 테이블)
- 등급 1 = 새싹, influence_score 기반 자동 승급

### 포인트 시스템
- 게시글 작성, 좋아요, 출석, 프로필 완성 등으로 적립
- 상점에서 확성기/고정글/닉네임변경 등 구매 가능

---

## 9. 보안

- **RLS:** 전 테이블 적용 (blog_quality_rules, blog_builder_registry 제외)
- **금칙어:** `banned_words` 테이블 17개
- **신고 시스템:** `reports` + `content_reports` + `report_logs`
- **자동 숨김:** 신고 누적 시 auto_hidden=true
- **관리자 권한 보호:** `prevent_privilege_escalation()` 트리거
- **Rate Limiting:** `api_rate_limits` 테이블

---

## 10. 동시 작업 시 주의사항

1. **git pull 먼저!** — 작업 시작 전 반드시 최신 코드 pull
2. **같은 파일 동시 수정 금지** — 특히 ThemeToggle, layout.tsx 등 공통 컴포넌트
3. **import 방식 확인** — default export vs named export 불일치로 사이트 다운된 전적 있음 (세션 16)
4. **작업보고서 작성** — 세션 끝날 때 `docs/sessions/session-XX.md` 커밋
5. **STATUS.md 업데이트** — 마지막에 끝나는 쪽이 갱신

---

## 11. 외부 API & 데이터 소스

| API | 용도 | 비고 |
|-----|------|------|
| 국토교통부 공공 API | 청약, 미분양, 실거래가 | molit_api |
| 주식 시세 API | 종목 시세 (KIS 등) | 99개 price=0 해결 필요 |
| Toss Payments | 결제 | test 키 → live 전환 필요 |
| Kakao/Google OAuth | 소셜 로그인 | |
| 카카오맵/네이버지도 | 블로그 지도 링크 | |

---

## 12. 파일 구조 (주요)

```
src/
├── app/
│   ├── feed/          — 커뮤니티 피드
│   ├── stock/         — 주식
│   ├── apt/           — 부동산
│   ├── discuss/       — 토론
│   ├── blog/          — 블로그
│   ├── admin/         — 관리자
│   ├── api/
│   │   ├── cron/      — 크론잡 라우트
│   │   ├── og/        — OG 이미지 생성
│   │   └── ...        — 기타 API
│   ├── layout.tsx     — 루트 레이아웃 (title template: `%s | 카더라`)
│   └── sitemap.ts     — 동적 사이트맵
├── components/        — 공통 컴포넌트
│   ├── Navigation     — 탭/메뉴 (CSS 변수 적용)
│   ├── ThemeToggle    — 다크모드 토글 (⚠️ default export)
│   └── ...
docs/
├── STATUS.md          — 프로젝트 현황 (항상 최신)
├── GUIDE.md           — 이 지침서
├── README.md          — docs 폴더 사용법
└── sessions/          — 세션별 작업 기록
```

---

*이 문서는 프로젝트 구조가 크게 변경될 때마다 업데이트해주세요.*
*작성: Claude Opus 4.6 | 2026-03-22*
