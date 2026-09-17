# count:'exact' 전수 감사 — 2026-09-17 (B1)

- 기준: origin/main 82df332e · `git grep -n "count: *['\"]exact['\"]" -- src` (docs/*.md 8건 제외) · 줄 번호는 **적용 전** 기준.
- 배경: 2026-09-16 장애 = social-proof exact count 7발(febc1901). exact 는 seq scan + 병렬 워커 → 워커 슬롯 기아.
- 행수: `pg_class.reltuples` (n_live_tup 교차 확인, 2026-09-17 실측). 10만+ 표는 **apt_transactions 750,554 · stock_price_history 140,931** 둘뿐(+ 뷰 원천 user_events 118,993).
- 경로: 핫 = 공개 SSR·컴포넌트·공개 API·sitemap/llms·공유 lib / 콜드 = api/admin·admin·api/cron·크론 전용 lib(big-event-fact-verify·blog-safe-insert·content/issue-context·cvn/rank-targets).
- 필터 열은 정규식 추정(select 뒤 200자 내 .eq/.gte/… 유무).

## 합계

| 성분 | 건수 |
|---|---|
| 전수 | 169 |
| 10만+ ∧ 핫 | 3 (stock/data:36 · llms.txt:28 의 apt_transactions 호출 · apt-fetcher:294) |
| 적용 | 2 |
| 존치 — 인덱스(EXPLAIN 확인) | 1 |
| 존치 — 10만+ 콜드 | 1 (whale-count · 관리자 전용 · 호출자 0) |
| 존치 — 소형(<10만) | 165 (핫 49 · 콜드 116) |

- DB 변경 없음 — 기존 `get_social_proof_counts()`(reltuples, service_role EXECUTE)의 trade_count·price_history_count 재사용. 호출은 getSupabaseAdmin(anon grant 회수 예정 대비).
- 감시 목록(5만+ 소형): cron_logs 82,734 · blog_post_images 65,986 · blog_posts 64,514 — 10만 도달 시 재감사. 회귀 테스트 BIG_TABLES 에 추가하면 된다.
- 회귀 고정: `src/__tests__/no-exact-count-hotpath.test.ts` — 핫패스에서 대형 표 exact(직접·헬퍼 경유) 차단 + 핫 파일별 exact 개수 허용목록.

## 전수 표

| 파일 | 줄 | 대상 | 행수 | 필터 | head | 경로 | 처방 | 적용 |
|---|---|---|---|---|---|---|---|---|
| src/app/(main)/apt/data/page.tsx | 57 | apt_subscriptions | 2,875 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/apt/data/page.tsx | 58 | apt_subscriptions | 2,875 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/blog/[slug]/page.tsx | 406 | profiles | 678 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/blog/[slug]/page.tsx | 409 | profiles | 678 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/discuss/DiscussClient.tsx | 115 | discussion_messages | 3 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/feed/FeedClient.tsx | 135 | posts | 12,915 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/feed/[id]/page.tsx | 236 | apt_subscriptions | 2,875 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/page.tsx | 298 | apt_sites | 6,626 | 있음 | — | 핫 | 존치(소형) | — |
| src/app/(main)/profile/[id]/ProfileGradeCard.tsx | 46 | invite_codes | 8 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/profile/[id]/page.tsx | 41 | follows | 2 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/profile/[id]/page.tsx | 42 | follows | 2 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/profile/[id]/page.tsx | 43 | comments | 17,066 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/stock/[symbol]/page.tsx | 147 | stock_quotes | 1,846 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/stock/data/page.tsx | 35 | stock_price_history | 140,931 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/(main)/stock/data/page.tsx | 36 | stock_price_history | 140,931 | 없음 | O | 핫 | 10만+∧핫 → get_social_proof_counts().price_history_count(reltuples) · 화면 「약」 | 적용 |
| src/app/(main)/stock/market/[code]/page.tsx | 54 | stock_quotes | 1,846 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/admin/(v4)/pdf-parsing/page.tsx | 20 | apt_subscriptions | 2,875 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/alerts/route.ts | 50 | admin_alerts | 1,273 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/alerts/route.ts | 85 | admin_alerts | 1,273 | 있음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/apt-stage/route.ts | 204 | apt_sites | 6,626 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/audit/route.ts | 210 | apt_subscriptions | 2,875 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/audit/route.ts | 215 | apt_subscriptions | 2,875 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-image-fix/route.ts | 47 | apt_complex_profiles | 39,714 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-image-fix/route.ts | 59 | apt_complex_profiles | 39,714 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-image-fix/route.ts | 69 | apt_sites | 6,626 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-image-fix/route.ts | 84 | apt_sites | 6,626 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-image-fix/route.ts | 109 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-pdf-parse/route.ts | 136 | apt_subscriptions | 2,875 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-reparse-v2/route.ts | 209 | apt_subscriptions | 2,875 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-reparse/route.ts | 24 | apt_subscriptions | 2,875 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/batch-total-hh/route.ts | 145 | apt_subscriptions | 2,875 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/comments/route.ts | 20 | comments | 17,066 | 없음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/fix-stock/route.ts | 98 | stock_quotes | 1,846 | 있음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issue-retry-stale/route.ts | 209 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issue-retry-stale/route.ts | 247 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 30 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 31 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 32 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 33 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 34 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 36 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 38 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 40 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 42 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 44 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/issues/route.ts | 46 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/marketing/kakao/history/route.ts | 23 | kakao_message_send_logs | 0 | 있음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/marketing/kakao/segment/preview/route.ts | 55 | v_admin_kakao_funnel | 뷰(최대 profiles 678) | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/naver-syndication/route.ts | 106 | naver_syndication | 93 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/naver-syndication/route.ts | 152 | naver_syndication | 93 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/notifications/route.ts | 35 | notification_bell | 167 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/posts/route.ts | 21 | posts | 12,915 | 없음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/push-broadcast/route.ts | 26 | profiles | 678 | 없음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/push-stats/route.ts | 11 | push_subscriptions | 13 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/redev-review/route.ts | 65 | apt_stage_review_queue | 38 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/send-email/route.ts | 27 | email_send_logs | 104 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/send-email/route.ts | 142 | email_subscribers | 501 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/send-email/route.ts | 145 | email_subscribers | 501 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/send-email/route.ts | 147 | email_subscribers | 501 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/send-email/route.ts | 149 | email_subscribers | 501 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/send-email/route.ts | 152 | email_send_logs | 104 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 19 | blog_posts | 64,514 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 20 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 28 | apt_sites | 6,626 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 29 | apt_sites | 6,626 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 30 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 31 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 32 | cron_logs | 82,734 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 33 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 34 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 35 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 37 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 38 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/seo-status/route.ts | 39 | stock_quotes | 1,846 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/user-list/route.ts | 34 | v_admin_user_list | 뷰(최대 user_daily_summary 26,905) | 없음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/verify-households/route.ts | 17 | apt_subscriptions | 2,875 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/admin/whale-count/route.ts | 13 | v_admin_whale_unconverted | 뷰(user_events 118,993) | 없음 | O | 콜드 | 10만+∧콜드(집계 뷰라 estimated 무의미) → 존치 + 사유 주석 | 존치 |
| src/app/api/apt/reviews/[id]/report/route.ts | 36 | reports | 1 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/apt/reviews/route.ts | 18 | apt_reviews | 0 | 있음 | — | 핫 | 존치(소형) | — |
| src/app/api/blog/search/route.ts | 19 | blog_posts | 64,514 | 있음 | — | 핫 | 존치(소형) | — |
| src/app/api/comments/[id]/route.ts | 32 | posts | 12,915 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/comments/route.ts | 76 | comments | 17,066 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/api/cron/apt-geocode/route.ts | 148 | apt_sites | 6,626 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/apt-parse-pdf-pricing/route.ts | 427 | apt_subscriptions | 2,875 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/apt-parse-pdf-pricing/route.ts | 443 | apt_subscriptions | 2,875 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/apt-price-sync/route.ts | 46 | apt_sites | 6,626 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/apt-price-sync/route.ts | 49 | apt_sites | 6,626 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/batch-cluster-submit/route.ts | 50 | blog_posts | 64,514 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/batch-cluster-submit/route.ts | 84 | blog_posts | 64,514 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/blog-image-supplement/route.ts | 130 | blog_post_images | 65,986 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/blog-internal-links/route.ts | 25 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/blog-market-pulse/route.ts | 65 | unsold_apts | 201 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/blog-monthly-market/route.ts | 35 | blog_posts | 64,514 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/blog-quality-prune/route.ts | 28 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/blog-series-assign/route.ts | 120 | blog_series | 11 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/blog-weekly-digest/route.ts | 55 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/blog-weekly-market/route.ts | 36 | unsold_apts | 201 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/cleanup/route.ts | 16 | notifications | 34,966 | 있음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/cleanup/route.ts | 23 | page_views | 26,762 | 있음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/cleanup/route.ts | 36 | cron_logs | 82,734 | 있음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/cleanup/route.ts | 42 | admin_alerts | 1,273 | 있음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/cvn-name-watch/route.ts | 83 | llm_usage_logs | 15,461 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/daily-stats/route.ts | 21 | page_views | 26,762 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/daily-stats/route.ts | 22 | page_views | 26,762 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/daily-stats/route.ts | 23 | daily_stats | 80 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/daily-stats/route.ts | 24 | daily_stats | 80 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/data-quality-monitor/route.ts | 20 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/data-quality-monitor/route.ts | 26 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/data-quality-monitor/route.ts | 29 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/data-quality-monitor/route.ts | 37 | stock_quotes | 1,846 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/data-quality-monitor/route.ts | 43 | apt_sites | 6,626 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/data-quality-monitor/route.ts | 46 | apt_sites | 6,626 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/email-digest/route.ts | 30 | email_send_logs | 104 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/email-scheduler/route.ts | 51 | email_send_logs | 104 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/gap-watch/route.ts | 40 | 헬퍼: apt_sites·apt_permits·presale_candidates | ≤6,626 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/gsc-sync/route.ts | 215 | gsc_search_analytics | 4,383 | 있음 | — | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/indexnow-full-sweep/route.ts | 62 | apt_complex_profiles | 39,714 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/invest-calendar-refresh/route.ts | 26 | invest_calendar | 20 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/issue-detect/route.ts | 330 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/issue-draft/route.ts | 520 | issue_alerts | 11,971 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/issue-draft/route.ts | 1033 | issue_alerts | 11,971 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/issue-preempt/route.ts | 52 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/issue-preempt/route.ts | 142 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/issue-preempt/route.ts | 260 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/issue-preempt/route.ts | 356 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/observe/route.ts | 120 | apt_observations | 99 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/permits-match/route.ts | 144 | apt_permits | 1,471 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/push-apt-deadline/route.ts | 24 | notifications | 34,966 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/push-daily-reminder/route.ts | 67 | notifications | 34,966 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/seed-comments/route.ts | 83 | comments | 17,066 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/seed-comments/route.ts | 133 | posts | 12,915 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/stock-image-crawl/route.ts | 110 | stock_images | 12,639 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/welcome-nudge/route.ts | 47 | notifications | 34,966 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/cron/welcome-nudge/route.ts | 102 | notifications | 34,966 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/app/api/discuss/route.ts | 16 | discussion_topics | 30 | 없음 | — | 핫 | 존치(소형) | — |
| src/app/api/follow/route.ts | 18 | follows | 2 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/follow/route.ts | 19 | follows | 2 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/likes/route.ts | 35 | posts | 12,915 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/api/likes/route.ts | 44 | posts | 12,915 | 없음 | O | 핫 | 존치(소형) | — |
| src/app/api/notifications/route.ts | 29 | notifications | 34,966 | 없음 | — | 핫 | 존치(소형) | — |
| src/app/api/notifications/route.ts | 35 | notifications | 34,966 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/notifications/route.ts | 79 | notifications | 34,966 | 있음 | — | 핫 | 존치(소형) | — |
| src/app/api/notifications/route.ts | 88 | notifications | 34,966 | 있음 | — | 핫 | 존치(소형) | — |
| src/app/api/polls/route.ts | 134 | post_poll_votes | 0 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/portfolio/route.ts | 86 | portfolio_holdings | 0 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/posts/route.ts | 20 | posts | 12,915 | 없음 | — | 핫 | 존치(소형) | — |
| src/app/api/report/route.ts | 35 | reports | 1 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/report/route.ts | 91 | posts | 12,915 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/share/route.ts | 14 | share_logs | 50 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/share/route.ts | 65 | share_logs | 50 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/api/stock/ai-analysis/route.ts | 54 | stock_ai_analysis | 0 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/image-sitemap.xml/route.ts | 22 | 헬퍼: apt_sites·apt_complex_profiles·blog_posts·stock_quotes | ≤64,514 | 없음 | — | 핫 | 존치(소형) | — |
| src/app/llms.txt/route.ts | 28 | 헬퍼: blog_posts·stock_quotes·apt_subscriptions·apt_sites·apt_complex_profiles·posts (+apt_transactions → 적용) | ≤64,514 | 없음 | O | 핫 | apt_transactions 호출만 10만+∧핫 → get_social_proof_counts().trade_count · 본문 「약」 / 나머지 소형 존치 | 적용(부분) |
| src/app/sitemap.xml/route.ts | 36 | blog_posts | 64,514 | 있음 | O | 핫 | 존치(소형) | — |
| src/app/sitemap.xml/route.ts | 53 | calc_results | 22 | 있음 | O | 핫 | 존치(소형) | — |
| src/components/Navigation.tsx | 127 | notifications | 34,966 | 있음 | O | 핫 | 존치(소형) | — |
| src/components/Navigation.tsx | 138 | notifications | 34,966 | 있음 | O | 핫 | 존치(소형) | — |
| src/components/apt/SiteFloatingActions.tsx | 89 | apt_comments | 1 | 있음 | O | 핫 | 존치(소형) | — |
| src/lib/apt-fetcher.ts | 240 | apt_sites | 6,626 | 있음 | O | 핫 | 존치(소형) | — |
| src/lib/apt-fetcher.ts | 253 | v_apt_subscription_imminent | 뷰(apt_sites 6,626·apt_subscriptions 2,875) | 있음 | O | 핫 | 존치(소형) | — |
| src/lib/apt-fetcher.ts | 288 | apt_sites | 6,626 | 있음 | O | 핫 | 존치(소형) | — |
| src/lib/apt-fetcher.ts | 294 | apt_transactions | 750,554 | 있음 | O | 핫 | 10만+∧핫 · deal_date≥7일 필터 · EXPLAIN Index Only Scan(idx_apt_trans_date / idx_apt_tx_sigungu_date) → 존치(인덱스) · exact-ok 표지 | 존치 |
| src/lib/big-event-fact-verify.ts | 49 | big_event_milestones | 1,247 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/lib/blog-safe-insert.ts | 291 | blog_posts | 64,514 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/lib/content/issue-context.ts | 178 | admin_alerts | 1,273 | 없음 | O | 콜드 | 존치(소형·콜드) | — |
| src/lib/cvn/rank-targets.ts | 60 | keyword_rank_targets | 3,552 | 있음 | O | 콜드 | 존치(소형·콜드) | — |
| src/lib/daily-report-data.ts | 128 | apt_sites | 6,626 | 있음 | O | 핫 | 존치(소형) | — |
| src/lib/daily-report-data.ts | 133 | stock_quotes | 1,846 | 있음 | O | 핫 | 존치(소형) | — |
| src/lib/llm/gateway.ts | 173 | llm_usage_logs | 15,461 | 있음 | O | 핫 | 존치(소형) | — |
