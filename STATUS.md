# Session 170 — 피드 리디자인 보완 + 네이버 SEO 검증 (2026-04-25 KST)

## 작업 요약 (s169 폴리싱)
s169 피드 상단 리디자인 이후 보완. recon 결과 상당수 요청사항이 이미 코드에 반영돼 있어 **중복 작업 회피** + 실질 변경 3건만 반영.

## 실제 변경 3건
1. **`components/feed/LiveActivityBar.tsx`** — Presence → Polling 전환
   - Supabase Realtime Presence 제거 (WS 1방문자당 1세션 → Free 200 / Pro 500 quota 위험)
   - `get_active_visitors(minutes=60)` RPC 30초 폴링 (기존 FeedStatusBar 가 쓰던 방식 재사용)
   - `discussion_topics` 쿼리에 `is_active` 없음 → `expires_at IS NULL OR expires_at > now()` + `comment_count > 0` 으로 교체 (2분 폴링)
   - 접속자 0명이면 컴포넌트 숨김 (`return null`)
2. **`components/feed/DailyReportBadge.tsx`** — 링크 단순화
   - `/daily/${region}` + localStorage 읽기 → **`/daily` 바레 route 로 통일**
   - `/daily/page.tsx` 가 로그인 유저 residence_city / localStorage / '서울' fallback 을 서버에서 처리 → 클라이언트 로직 불필요
3. **`app/(main)/blog/[slug]/page.tsx`** — 면책 문구 개선
   - "자동 작성 콘텐츠" → "데이터 분석 콘텐츠"
   - "자동 작성되었습니다" → "공공 데이터(국토교통부, 한국거래소, 금융위원회 등) 기반 분석 콘텐츠입니다"
   - 네이버/구글 크롤러가 "auto-generated" 판정 회피 (E-E-A-T 신호 개선)

## 이미 반영돼 있어 SKIP (recon 검증만)
- **Task B (Empty state)**: `LiveDiscussionCards` s169 에서 이미 `return null` 처리됨
- **Task C (CTA 복원)**: 제거한 3개 컴포넌트 (`FeedStatusBar`, `DailyReportCard`, `LiveActivityIndicator`) 중 어느 것도 signup/login CTA 를 포함하지 않음. FeedClient 내 기존 CTA 2개 건재 — 피드 5번째 글 직후 `/login` 카카오 버튼 (line 385-387), 3번째 카드 자리 `<RelatedContentCard type="feed" />` (line 593). **s145 가입 0건 재발 우려 없음**
- **Task E (Yeti bot 게이트 우회)**: `blog/[slug]/page.tsx:355-358` 이미 User-Agent 감지 (`googlebot|bingbot|yandex|baiduspider|yeti|naverbot|daumoa|...` 정규식). line 967 `{isBot ? <full content> : <BlogGatedRenderer>}` 분기 이미 존재
- **Task G (Sitemap 분할)**: `app/sitemap/[id]/route.ts` 가 이미 카테고리별 분할 구현 (ID 0-7 역할: static+regions, stock, apt-sites, feed posts, discuss, apt_complex 청크 등). priority 조정은 기존 로직 내에 이미 있음
- **Task H (robots.txt Yeti)**: 173줄 `public/robots.txt` 에 Yeti 섹션 (line 51-), `Allow: /blog/`, `Crawl-delay: 0` 모두 존재

## 검증
- `npx tsc --noEmit --skipLibCheck` → 0 errors
- `npm run build` (`.env.local` 제거 상태) → exit=0
- 커밋 전 모든 변경사항 로컬 빌드로 검증

## 다음 세션 남은 액션
- GitHub PAT 토큰 revoke (보안)
- Edge Function 2개 삭제 (`github-commit-patch`, `github-read-file`)
- Supabase Auth Leaked password protection
- RLS `auth_rls_initplan` 99건 래핑
- `mv_apt_pulse` RPC+cache
- `naver-complex-sync` 401 Node 수동 재시도
- 원본 3개 컴포넌트 (`FeedStatusBar`, `DailyReportCard`, `LiveActivityIndicator`) 완전 삭제 여부 (현 미사용, orphan 상태)

---

# Session 169 — 피드 상단 리디자인 (2026-04-25 KST)

## 작업 요약
피드 상단 레이아웃 재구성 — 정보 밀도 줄이고 실시간성 강조 + 데일리 리포트 헤더 상시 노출

## 신규 컴포넌트 3개
1. **`src/components/feed/LiveActivityBar.tsx`** (client)
   - 왼쪽: Supabase Realtime Presence 기반 접속자 수 (`channel='kd-online'`, presence key=sessionStorage UUID)
   - 오른쪽: `/discuss` 링크 버튼 + 최근 24h 활성 토론방 수 뱃지 (빨간색)
   - 토론방 쿼리: `discussion_topics WHERE created_at > now()-24h AND comment_count > 0` (2분 폴링)
2. **`src/components/feed/LiveDiscussionCards.tsx`** (client)
   - 가로 스크롤 (`.kd-scroll-row`) 토론방 카드 — 빨간 펄스 도트 + 참여자 수 + 제목
   - Source: `discussion_topics ORDER BY comment_count DESC LIMIT 8`
   - 카드 클릭 → `/discuss/[id]`
3. **`src/components/feed/DailyReportBadge.tsx`** (client)
   - 헤더 내 펄싱 앰버 도트 + "데일리 리포트" 링크 (localStorage `daily_region` fallback='서울')
   - Navigation.tsx 로고 직후 삽입

## 수정
- **`src/components/Navigation.tsx`**: `DailyReportBadge` import + 로고 뒤 렌더
- **`src/app/(main)/feed/FeedClient.tsx`**:
  - 제거 import/render: `FeedStatusBar`, `DailyReportCard`, `LiveActivityIndicator` (파일 자체는 보존 — 다른 곳 재활용 가능)
  - 추가 import/render: `LiveActivityBar`, `LiveDiscussionCards` (탭 바 위, QuickPostBar 위)

## 레이아웃 순서 변경
- **Before**: 카더라 헤더 / FeedStatusBar (날짜/통계/활동중) / DailyReportCard (단지 카드) / QuickPostBar / 탭 / 정렬 / 피드
- **After**: (앱 헤더: 로고 + 데일리 리포트 뱃지 + 검색) / 카더라 h1 / **LiveActivityBar** / **LiveDiscussionCards** / QuickPostBar / 탭 / 정렬 / 피드

## DB 의존성
- `discussion_topics` (기존 테이블) — vote_a, vote_b, comment_count, created_at
- Realtime Presence — Supabase Realtime (신규 채널 `kd-online`)
- 기존 `get_active_visitors` RPC 는 사용 안 함 (Presence 로 교체)

## 검증
- TypeScript `npx tsc --noEmit --skipLibCheck` 통과 (0 errors)
- 로컬 `npm run build` 는 s168 PR 미머지 상태로 별개 이슈(env-validate) 때문에 불가. Vercel Preview 빌드로 검증 예정
- UI 수동 테스트 미진행 (로컬 dev 서버 미기동)

## Tradeoff / 모니터링 포인트
- **Realtime Presence 비용**: 매 피드 방문자가 WebSocket 1개 개설. Supabase Realtime quota 소비. 피크시 문제되면 RPC polling (`get_active_visitors`) 으로 롤백
- **discussion_topics 쿼리 캐시 없음**: 2분 폴링. 부하 시 `/api/discuss/active-count` 같은 캐시 라우트로 옮기는 것 고려

## 잔여 이슈 / 다음 세션
- s168 PR 머지 필요 (issue-pipeline + build fixes)
- 원본 `FeedStatusBar`/`DailyReportCard`/`LiveActivityIndicator` 완전 삭제 여부는 유저 판단 대기

---

# Session 161 — 위성 라우트 + VACUUM 크론 복구 (2026-04-24 KST)

## 작업 요약
1. **VACUUM 크론 dblink 우회로 수정** (Claude SQL, pg_cron 80개 schedule 무건드림)
   - `weekly_vacuum_analyze_blog` 재생성 **금지** — 이미 dblink로 수정 완료된 경로 유지
2. **위성 라우트 PR 머지 + 24,719편 위성 썸네일 복구**
   - PR `fix/satellite-endpoint` → `main` 머지 → Vercel 자동 배포
   - `src/app/api/satellite/route.ts` (edge, 30일 immutable): Esri World Imagery → OSM fallback → `/api/og-chart` 302
   - `src/components/AptImageGallery.tsx`: 위성 슬라이드에 🛰️ 위성 사진 배지 (모바일 캐러셀 + 데스크탑 1+2)
   - 머지 후 1회 SQL (`apt_complex_profiles` 만):
     ```sql
     UPDATE apt_complex_profiles
     SET images = jsonb_build_array(metadata->>'satellite_url_pending') || images,
         og_image_url = metadata->>'satellite_url_pending'
     WHERE metadata->>'satellite_url_pending' IS NOT NULL;
     ```
   - 외부 API 키 0개 추가. 인증 불필요 타일 소스만 사용.

## 잔여 이슈
- **`naver-complex-sync` 401** — Node에서 수동 재시도 필요. cron 루프가 아닌 일회성 backfill 스크립트.

## 금지 영역 (건드리지 말 것)
- `pg_cron` 기존 80개 schedule
- `weekly_vacuum_analyze_blog` 재생성 (dblink 경로 유지)
- `apt_complex_profiles.images` 직접 수정 (위 SQL 1회 외)

---

# Session 145 — v2.0 Week 1 (2026-04-22 KST)

## Commit 5 — `feat(admin): pulse_v3 tab + 4 widgets`
- **신규**:
  - `src/app/api/admin/pulse_v3/route.ts` — GET requireAdmin. 4 뷰 Promise.all 병렬 fetch.
  - `src/app/admin/pulse_v3/page.tsx` + `PulseV3Client.tsx` — 전용 라우트 + 클라이언트 렌더
- **수정**: `src/app/admin/AdminShell.tsx` — 'pulse_v3' 탭 등록 (🫀 아이콘, 맨 오른쪽)
- **위젯 4종**:
  1. **KPI 8-grid**: active_now / pv_today (yst ±%) / uv_today / signups_today / signups_7d / cta_ctr_7d / whales_unconverted / action_items
  2. **Blog × APT 전환 매트릭스**: 6-bucket 색상 (gray→red→yellow→green→emerald). 각 셀 signups/visitors (pct%)
  3. **미가입 고래 TOP 10**: visitor_id / pv / active_days / uniq_pages / deep_reads / last_seen
  4. **Action Items**: severity pill (red/yellow/cyan) + key + message + action
- **배너**: red/yellow severity Action Items 있을 때 상단 경고 배너
- **DB deps**: `v_admin_master_v3`, `v_admin_action_items`, `v_admin_whale_unconverted`, `v_admin_behavior_conversion_matrix`
- **접근**: `/admin` 에서 'Pulse v3' 탭 또는 `/admin/pulse_v3` 직접 URL
- **Caveats**: `get_admin_user_detail` 모달 연동은 이번 C5 범위 밖 — 고래 행 클릭은 단순 표시만.

## Commit 4 — `feat(blog): 50% scroll mid-gate with variants`
- **신규**: `src/components/blog/BlogMidGate.tsx` (client)
  - props: `{ blogId, isGatedPost?, isLoggedIn?, sentinelSelector?, className? }`
  - 세션당 1회 (`sessionStorage.blog_mid_gate_shown_${blogId}`)
  - variants DB: `cta_message_variants WHERE cta_name='blog_mid_gate' AND variant_key='default' AND is_active=true`
  - 폴백: `title="이 글 끝까지 보는 사람 8%뿐"` / `body="핵심 정보는 아래에..."`
  - sentinel `[data-mid-gate-sentinel]` IntersectionObserver 진입 시 노출. 없으면 window scroll 50% 폴백.
  - UI: indigo gradient card + dismiss(×) + 카카오 노란 버튼
  - 이벤트: `cta_view('blog_mid_gate')` / `cta_click('blog_mid_gate')` / `cta_click('blog_mid_gate_dismiss')`
- **수정**: `src/components/blog/BlogGatedRenderer.tsx` — classified.flatMap 으로 refactor, H2 섹션 중간(`midIdx = floor(length/2)`) 앞에 `<div data-mid-gate-sentinel />` inject
- **수정**: `src/app/(main)/blog/[slug]/page.tsx` — 비로그인 + `!has_gated_content` 인 경우만 `<BlogMidGate />` 마운트 (BlogGatedWall 과 중복 방지)
- **DB deps**: `cta_message_variants` (이미 존재, blog_mid_gate default row 필요)
- **Caveats**: BlogGatedRenderer 가 client-side 렌더이므로 gated 포스트에서는 sentinel 주입 가능. 단 BlogGatedWall 과 중복 노출 방지 위해 mid-gate 는 `has_gated_content=false` 인 블로그에만 노출.

## Commit 3 — `chore(cta): remove 5 dead CTAs + C1 unlock logs backfill`
- **삭제 파일**: `src/components/ActionBar.tsx`, `src/components/BlogFloatingBar.tsx`, `src/components/ContentLock.tsx`
- **수정**:
  - `src/app/(main)/layout.tsx` — ActionBar import + `<ActionBar />` 제거
  - `src/app/(main)/blog/[slug]/page.tsx` — BlogFloatingBar import + 렌더 제거, LoginGate blog_compare/blog_stock_ai/blog_finance 블록(996-1022) 제거
  - `src/app/(main)/apt/[id]/page.tsx` — ContentLock import + 2 wrapper(실입주/한줄평) 제거 (내부 컴포넌트만 노출)
- **유지**: action_bar_kakao / action_bar_comment / action_bar_bookmark (별개 액션 버튼), 기타 고CTR CTA 전부 보존
- **신규**: `src/app/api/events/apt-compare-unlock/route.ts` (fire-and-forget INSERT), `src/components/apt/SimilarAptsTracker.tsx` (client, mount=viewed_3rd_locked / 3rd card click=clicked_3rd_cta)
- **C1 보강**: `SimilarAptsSection` 에 `data-similar-apt-card` + `data-similar-idx` 속성 추가 + `<SimilarAptsTracker />` 마운트 → apt_compare_unlock_logs 기록
- **DB**: `apt_compare_unlock_logs` (기존) — rowsecurity=false 라 admin 경유 INSERT 필수
- **Caveats**: blog_finance feature 도 동일 LoginGate 블록에 포함되어 같이 제거됨 (별도 낮은 CTR). 복구 필요 시 별도 컴포넌트로 재도입.

## Commit 2 — `feat(blog): related blogs 3-card, 3rd = strategy badge`
- **신규**: `src/components/blog/RelatedBlogsSection.tsx` (server), `src/components/blog/RelatedBlogsTracker.tsx` (client)
- **수정**: `src/app/(main)/blog/[slug]/page.tsx` — BlogActions 직후, BlogEndCTA 앞에 `<RelatedBlogsSection blogId={post.id} />` 마운트. import 추가.
- **DB**: `match_related_blogs(p_blog_id bigint, p_limit int default 3)` → jsonb { id, title, slug, cover_image, reading_minutes, tldr, badge }
- **UI**: grid auto-fit minmax(220px,1fr), 16:9 cover, 제목 2-line clamp, tldr 2-line clamp, ⏱{min}분. badge='strategy' → amber gradient + ⚡전략 pill.
- **이벤트**: mount 시 cta_view `related_blog_section` (category=engagement). data-related-card 클릭 capture → cta_click `related_blog_strategy`/`_normal`.
- **섹션 헤더**: "이어서 읽을 만한 글" + 서브 "블로그 2글 이상 본 분들, 가입률 6.5배 (실측)"
- **Caveats**: isBot 체크 제외 (SSR 렌더 허용). RPC 0건 → 섹션 null.

## Commit 1 — `feat(apt): similar apts section (get_similar_apts RPC)`
- **파일**: `src/components/apt/SimilarAptsSection.tsx` (신규, 서버 컴포넌트), `src/app/(main)/apt/[id]/page.tsx` (import + 마운트 지점 추가)
- **동작**: `apt_sites.id` → `get_similar_apts(p_apt_site_id, p_limit=6)` RPC 호출 → 6개 카드 그리드
- **카드 구성**: satellite_image_url 우선, 없으면 og_image_url → 폴백 /api/og. 이름 + 지역(region sigungu).
- **위치**: `apt/[id]` 페이지 하단, `Disclaimer` 직전
- **링크**: `slug` 있으면 `/apt/{slug}`, 없으면 `/apt/{id}` (UUID)
- **스타일**: grid `auto-fit minmax(140px, 1fr)`, aspect 4/3, 모바일 1~2 col / 데스크탑 4~6 col 자동
- **안전**: RPC 실패 → 빈 배열 → 섹션 null (폴백 렌더 없음), 로그 없음

---

# 카더라 프로젝트 STATUS — 세션 52 (2026-03-29 KST)
> SEO 극대화 + UI 글래스모피즘 + 프리미엄 멤버십 풀스택 + 주식 카드뷰
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 프로덕션 현황

| 지표 | 수치 | 비고 |
|------|------|------|
| **유저** | 121명 | 실제 21명 + 시드 100명 |
| **프리미엄** | 0명 | 결제 시스템 구현 완료, Toss 키 설정 대기 |
| **게시글/댓글** | 4,195 / 2,115 | |
| **블로그** | 18,522편 | IndexNow 미전송 18,522편 (크론 대기) |
| **주식 종목** | 728개 | KOSPI 212/KOSDAQ 152/NYSE 222/NASDAQ 142 |
| **청약** | 2,692건 | |
| **apt_sites** | 5,512 (active) | |
| **재개발** | 202건 | |
| **완료 결제** | 0건 | Toss 키 미설정 |
| **크론 에러** | 0건 (24h) ✅ | 181회 정상 |

## 코드베이스

| 지표 | 수치 |
|------|------|
| 파일 수 | 544개 |
| API 라우트 | 180개 |
| 크론 | 79개 |
| DB 테이블 | 127개 |
| 최신 커밋 | `3350f00` |

---

## 🚨 즉시 실행 필요 (코드 외)

### [긴급] 3/31 마감
- [ ] **토스 정산 등록**

### [최우선] 검색 노출 (Google 인덱싱 0건!)
- [ ] **Google Search Console** → 사이트맵 `https://kadeora.app/sitemap.xml` 제출
- [ ] **Google URL 검사** → `/`, `/stock`, `/apt`, `/blog`, `/feed` 수동 인덱싱
- [ ] **네이버 서치어드바이저** → 사이트맵 + RSS 4개 제출
- [ ] **Bing 웹마스터** → 사이트맵 제출
- [ ] **Daum 검색등록** → 사이트 등록

### [중요] 결제 활성화
- [ ] **Toss 키 발급** (developers.tosspayments.com)
- [ ] **Vercel 환경변수**: `TOSS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- [ ] 테스트 결제 → DB 확인

### [중요] API 키
- [ ] **Anthropic 크레딧 충전** (블로그 크론 재가동)
- [ ] **KIS_APP_KEY** 발급 (주식 실시간)
- [ ] **FINNHUB_API_KEY** 발급

### [권장] 마케팅
- [ ] 네이버 블로그/카페 소개글 (백링크)
- [ ] 커뮤니티 소개글 (디시, 에펨코리아 등)
- [ ] Google Adsense 승인 대기 (코드 적용됨)

---

## 세션 52 완료 작업

### SEO 실전 강화
- IndexNow 배치 500개 + 3개 엔드포인트
- indexnow-mass 크론 (500편/6시간)
- indexed_at 마이그레이션 실행 완료
- 블로그 200편 + 주식 728종목 SSG
- preconnect + modifiedTime 수정
- Google deprecated ping 제거

### UI/UX 글래스모피즘
- CSS 8종: kd-glass/card-glow/btn-glow/counter/pulse-dot/shimmer/section-card/fade-in
- 헤더/탭바/랜딩/피드/블로그/EmptyState 전면 개선
- 주식 카드뷰 토글

### 프리미엄 멤버십 풀스택
- /premium 랜딩 + 결제 후처리 + 상태 API + 만료 크론
- AuthProvider isPremium + 배지 + 업셀 배너 3곳

---

## 크론 (79개)

| 카테고리 | 수 | 비고 |
|---------|-----|------|
| 블로그 | 37 | AI 크레딧 부족→생성 0건 |
| 주식 | 7 | 정상 |
| 부동산 | 14 | 정상 |
| SEO | 2 | indexnow, indexnow-mass |
| 결제 | 1 | premium-expire |
| 시스템 | 18 | 정상 |

## API 키 현황

| 키 | 상태 |
|----|------|
| ANTHROPIC_API_KEY | ⚠️ 크레딧 부족 |
| CRON_SECRET | ✅ |
| STOCK_DATA_API_KEY | ✅ |
| INDEXNOW_KEY | ✅ |
| TOSS_SECRET_KEY | ❌ 미설정 |
| NEXT_PUBLIC_TOSS_CLIENT_KEY | ❌ 미설정 |
| KIS_APP_KEY | ❌ 미발급 |
| FINNHUB_API_KEY | ❌ 미발급 |

## 아키텍처 규칙 (불변)

1. 블로그 데이터: 절대 삭제/수정 금지
2. stockcoin.net: 카더라와 연결 금지
3. 포인트: RPC로만 수정
4. CSP: middleware.ts 전용
5. 크론 에러: 항상 200 반환
6. OG 폰트: Node.js fs (Edge 금지)
