# 공개 RPC 허용목록 대장 (2026-09-17 · B3)

public 스키마 함수 중 `anon` 또는 `authenticated` 가 EXECUTE 를 가진 것 **전수**와 그 처분.

## 0. 수치

| 구분 | 적용 전 | 처분 | 적용 후 |
|---|---:|---|---:|
| 공개 함수 전체 | 459 | | 392 |
| └ 확장 소유(pgroonga 143 · dblink 39 · pg_trgm 31 · hypopg 11 · index_advisor 1) | 225 | 범위 밖(소유자 supabase_admin — postgres 가 회수 못 함) | 225 |
| └ 비확장 | 234 | | 167 |
| &nbsp;&nbsp;· 쓰기 ∨ DEFINER | 117 | **revoke 67** · 존치(의도) 17 · **존치(애매) 33** | 50 |
| &nbsp;&nbsp;· INVOKER ∧ 읽기 전용 | 117 | 존치(RLS·테이블 권한이 곧 경계) | 117 |

마이그레이션:
- `20260917041755 b3_default_privileges_revoke_2026_09_17` — 기본권한 닫기 + 더미 함수 단언
- `20260917041952 b3_rpc_public_revoke_2026_09_17` — 67종 revoke + 말미 단언(ACL·잔존 167·존치 표본)

## 1. 기본권한(pg_default_acl) 상태

| 소유자 | 범위 | 적용 전 | 적용 후 |
|---|---|---|---|
| postgres | public · 함수 | postgres, anon, authenticated, service_role | postgres, service_role |
| postgres | **전역** · 함수 | (없음 = 내장 기본값 PUBLIC=X) | postgres 만 — PUBLIC 회수 |
| supabase_admin | public · 함수 | postgres, anon, authenticated, service_role | **변경 불가** — 42501 permission denied to change default privileges |

⚠️ 스키마별 기본권한은 전역 기본값에 «더해질 뿐» 이다. `IN SCHEMA public ... FROM PUBLIC` 만으로는 새 함수가 `=X/postgres` 를 달고 태어났다
(1차 적용이 더미 함수 단언에 걸려 전체 롤백됨). 전역 `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` 로 닫았다.
영향: postgres 가 이후 만드는 **모든 스키마** 의 함수가 PUBLIC 없이 태어난다. 공개가 필요하면 GRANT 동봉(RULES#150).

⚠️ 잔존: supabase_admin 소유 기본값(public 함수)과 postgres 소유 `storage` 스키마 기본값은 여전히 anon·authenticated 를 부여한다.
확장 설치·Supabase 내부 작업으로 생기는 함수는 계속 열려 태어난다.

## 2. 판정 방법

- **앱 호출**: worktree(origin/main) 전체에서 따옴표 리터럴 `'이름'` git grep (`src/types/database.ts`·migrations·docs·*.md 제외).
  `.rpc('x'` 정규식만으로는 `(sb.rpc as any)('x')` 를 놓친다 — get_my_access_level·get_stock_gate_config 가 그랬다.
  메인 체크아웃 작업 트리(다른 세션 미커밋분)도 같은 grep 0건 확인.
- **호출 역할**: edge_logs 최근 24h `/rest/v1/rpc/<이름>` × JWT role. 긍정 대조: fn_region_sale_counts·get_apt_complex_hero 1,245건이 잡히는 질의로 revoke 대상 0건 확인.
- **쓰기(W)**: prosrc 에 insert into · update … set · delete from · truncate · merge · refresh materialized · execute.
- **DEFINER(D)** / **auth.uid() 가드(U)** / **트리거(T, RETURNS trigger — /rpc 호출 불가, 발화 시 EXECUTE 검사 없음)**.
- **DB 내부 의존**: 다른 함수 본문·뷰·MV·RLS 정책·컬럼 기본값·cron.job 명령 대조.
  - RLS 정책·INVOKER 함수·뷰에서 부르는 함수는 «호출자 권한» 으로 검사되므로 revoke 하면 깨진다 → is_current_user_admin 존치.
  - DEFINER 함수 안에서 부르는 것은 소유자(postgres) 권한 → revoke 영향 없음.
  - cron.job 은 username=postgres → revoke 영향 없음.
- **과거 명시 GRANT**: schema_migrations 에서 `GRANT EXECUTE ON FUNCTION <이름> … TO anon|authenticated|PUBLIC` 버전.

## 3. revoke — «의도 아님» 67종

기준: 앱 호출 0 ∧ 24h 로그 호출 0 ∧ (W ∨ D). 처분: `REVOKE ALL … FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE … TO service_role`.
되돌리기: `GRANT EXECUTE ON FUNCTION <sig> TO anon, authenticated;`

| 함수 | 성질 | 비고(DB 내부 의존 · 과거 GRANT 버전) |
|---|---|---|
| apt_region_recent_change(text,integer) | D | |
| backfill_subscription_stages(date) | W | |
| blog_category_stats() | D | |
| check_nickname_available(text) | D | |
| deduct_points(uuid,integer,text,jsonb) | DWU · authenticated 만 | GRANT 20260423060032·060118 |
| deduct_points(uuid,integer) | DWU · authenticated 만 | 〃 |
| fn_lead_new_alert() | DWT | 트리거 leads.trg_lead_new_alert |
| fn_log_apt_change() | DWT | 트리거 apt_sites.trg_apt_change_log |
| get_apt_3y_trend(uuid) | D | GRANT 20260501033255 |
| get_apt_complex_stage6(text) | D | GRANT 20260418045835 |
| get_apt_fresh_cascade(text,integer) | D | ← get_apt_unified_carousel(D) · GRANT 20260510080735 |
| get_apt_imminent_cascade(text,integer) | D | ← get_apt_unified_carousel(D) · GRANT 20260510080735 |
| get_apt_redev_cascade(text,integer) | D | ← get_apt_unified_carousel(D) · GRANT 20260510080735 |
| get_apt_site_page(text) | D | ← get_apt_subscription_page(D) · GRANT 20260510082135 |
| get_apt_sites_with_thumbnails(text,text,integer,integer,text) | D | GRANT 20260418180818 (sync-apt-sites 주석에만 언급) |
| get_apt_subscription_page(text) | D | GRANT 20260510081606 (20260510081647 이 «SSR 필요» 로 남겼으나 현재 호출자 0) |
| get_apt_transactions_with_thumbnails(integer,integer,text,text) | D | GRANT 20260418180859 |
| get_apt_unified_carousel(text) | D | GRANT 20260510080735 |
| get_blog_category_stats() | D | |
| get_blog_related_posts(bigint,integer) | D | GRANT 20260419045807 |
| get_blog_teaser_config() | D | GRANT 20260422042058 |
| get_carousel_active_subscriptions(integer) | D | GRANT 20260417114827 |
| get_carousel_calc_topic(text,integer,integer) | D | GRANT 20260417115439 |
| get_carousel_hot_redevelopment(integer) | D | GRANT 20260417114827 |
| get_carousel_related_blogs(text,text,integer) | D | GRANT 20260417114827 |
| get_carousel_related_complexes(text,integer) | D | GRANT 20260417114827 외 14건 |
| get_carousel_same_sector_stocks(text,integer) | D | GRANT 20260417115439 |
| get_carousel_similar_complexes(text,integer) | D | GRANT 20260417115439 |
| get_carousel_top_stocks(text,text,integer) | D | GRANT 20260417114827 |
| get_homepage_hero() | D | GRANT 20260417130343 |
| get_homepage_v2_fast() | D | GRANT 20260419045807 |
| get_hot_apt_complexes(text,integer) | D | GRANT 20260417150035 |
| get_hot_polls(integer) | D | GRANT 20260417122552 |
| get_hot_posts_by_region(text,integer) | D | |
| get_hot_posts_with_images(integer,integer) | D | GRANT 20260419055046 |
| get_issue_config(text) | D | |
| get_magnet_content(integer,integer) | D | GRANT 20260417150035 |
| get_main_page_data(text) | D | GRANT 20260501033225 외 3건 |
| get_onboarding_value_content() | D | GRANT 20260417121608 |
| get_region_apt_stats() | D | GRANT 20260417145423 |
| get_rent_stats(text,integer) | D | |
| get_sidebar_widgets(text) | D | GRANT 20260417130343 |
| get_stock_dashboard() | D | |
| get_stock_related_blogs(text,integer) | D | GRANT 20260419045807 |
| get_stocks_with_thumbnails(text,integer,integer,text) | D | GRANT 20260418180834 |
| handle_post_like() | WT | (연결 트리거 없음) |
| increment_apt_view(text) | W | |
| increment_banner_click(bigint) | DW | |
| increment_banner_impression(bigint) | DW | |
| increment_calc_result_share(text) | DW | GRANT 20260417060323 |
| increment_calc_result_view(text) | DW | GRANT 20260417060323 |
| increment_discussion_messages_count() | DWT | (연결 트리거 없음) |
| increment_likes(bigint) | DW | |
| increment_popup_click(integer) | W | |
| increment_post_view(bigint) | DW | |
| increment_user_likes(uuid,integer) | DWU · authenticated 만 | GRANT 20260423060801 |
| increment_view_count(bigint,uuid) | DW | |
| log_apt_active_change() | WT | 트리거 apt_sites.trg_apt_active_change |
| log_teaser_debug(text,text,jsonb) | DWU | GRANT 20260422042608 · 20260509094533 · 20260509095322 |
| mark_all_notifications_read(uuid) | W | |
| resort_gated_by_attractiveness(bigint) | W | |
| safe_search_posts(text,integer) | D | |
| site_uptime_probe() | W | cron job 173 `*/5 * * * *`(GMT·KST 동일 5분 주기) username=postgres → 영향 없음 |
| strip_external_body_images(bigint,text) | W | |
| trg_apt_site_stage_change() | DWT | 트리거 apt_sites.apt_sites_stage_change |
| trg_bpi_reset_quality_checked_at() | DWT | 트리거 blog_post_images.trg_bpi_reset_quality_checked_at |
| update_series_count(text) | W | |

과거 명시 GRANT 이력이 있는 37종은 «당시엔 의도» 였다. 소비자(캐러셀·홈 v2·v5 요약 등)가 코드에서 사라진 뒤 GRANT 만 남은 것이다.

## 4. 존치 — 의도 (17)

앱이 사용자 세션(anon/authenticated) 클라이언트로 부르거나, 로그에 anon/authenticated 호출이 있거나, RLS 가 호출자 권한으로 평가한다.

| 함수 | 성질 | 근거 |
|---|---|---|
| award_points | DWU · authenticated 만 | 사용자 경로 라우트 다수(ChatRoom·feed/*·profile/*) |
| complete_signup_frictionless | DWU · authenticated 만 | auth/callback |
| get_apt_complex_hero | D | apt/[id] page (로그상 service_role 1,047) |
| get_apt_gate_config | D | api/apt/gate-config (사용자 클라이언트) |
| get_blog_images_dedup | D | 로그 anon 3,545 |
| get_homepage_for_anonymous | D | feed page |
| get_my_access_level | DU | GatedStockSection 브라우저 `(sb.rpc as any)` |
| get_signup_value_props | D | SignupNudgeModal |
| get_stock_gate_config | D | GatedStockSection 브라우저 `(sb.rpc as any)` |
| get_stock_images_gallery | D | 로그 anon 907 |
| increment_listing_click | DW | consultant/listing |
| increment_listing_impression | DW | consultant/listing |
| increment_site_interest | DW | apt/interest · apt/sites/interest |
| is_current_user_admin | DU · authenticated 만 | **RLS 정책 6곳**(admin_score_history · kakao_message_send_logs · consent_history×2 · marketing_segments · llm_usage_logs) |
| log_search | DW | search page·api/search (로그상 service_role 32) |
| register_apt_interest | DWU · authenticated 만 | subscription/register-interest |
| stock_market_distribution | D | stock/data page |

## 5. 존치 — 애매 (33)

앱 호출은 있으나 코드상 service_role(admin) 클라이언트 경로만 보이고, 24h 로그도 service_role 뿐이다(또는 로그 0).
anon 이 필요 없을 개연이 높지만 «공개 쪽 보수» 로 이번엔 건드리지 않는다. **다음 회차 revoke 후보.**

| 함수 | 성질 | 코드 호출처 | 24h 로그 |
|---|---|---|---|
| admin_toggle_admin | DW · authenticated 만 | api/admin/users/[id] | 0 |
| get_admin_user_detail | D · authenticated 만 | api/admin/user-detail/[id] | 0 |
| blog_publish_from_queue | W | cron/blog-publish-queue | service_role 3 |
| blog_queue_status | D | cron/blog-publish-queue | service_role 2 |
| check_publish_gate | D | cron/issue-publish · admin backfill | service_role 1,828 |
| fn_region_sale_counts | D | lib/region/select-server | service_role 197 |
| get_apt_nearby_sites | D | AptCompareTable · AptSidebar | service_role 6,450 |
| get_apt_rankings | D | api/public/apt-rankings | 0 |
| get_apt_v5_summary | D | `_legacy/s262` 만 | 0 |
| get_calc_topic_sitemap_urls | D | sitemap/[id] | service_role 3 |
| get_entity_comment_counts | D | lib/comments/rpc | 0 |
| get_exchange_rate_trend | D | api/public/exchange-trend | 0 |
| get_similar_apts | D | SimilarAptsSection | 0 |
| get_social_proof_counts | D | api/stats/social-proof | service_role 31 |
| get_stock_52w_range | D | api/public/stock-52w | 0 |
| get_stock_ma | D | api/public/stock-ma | service_role 66 |
| get_unsold_trend | D | api/public/unsold-trend | 0 |
| increment_blog_view | DW | api/blog/view | service_role 26 |
| increment_calc_topic_view | DW | calc/topic/[keyword] | service_role 30 |
| increment_email_click | W | webhook/resend | 0 |
| increment_email_open | W | webhook/resend | 0 |
| increment_popup_impression | W | api/popup | 0 |
| increment_push_click | W | api/push/click | 0 |
| increment_site_view | DW | api/apt/view | service_role 385 |
| increment_stock_view | W | api/stock/view | service_role 64 |
| inject_hub_mapping_for_post | W | cron/issue-draft · issue-publish | service_role 21 |
| log_search_click | DW | api/search/click | service_role 1 |
| refresh_apt_overview | W | cron/refresh-mv | 0 |
| refresh_subscription_stages | W | cron/stage-derive | service_role 1 |
| rematch_blog_cover | W | cron/blog-cover-auto-enhance | 0 |
| safe_get_calc_topic | D | calc/topic/[keyword] | service_role 62 |
| search_rent_transactions | D | api/public/rent-search | 0 |
| fn_insert_lead | DW · **anon 만** | 레포 호출 0 — 외부 Apps Script 가 anon 으로 호출(LeadForm 주석) · 20260821063942 외 3건이 anon 명시 GRANT | 0 |

⚠️ 코드상 클라이언트 판별은 파일 단위 휴리스틱(getSupabaseAdmin 등 import 여부)이다. revoke 전에는 호출 라인 단위로 재확인할 것.

## 6. 존치 — INVOKER ∧ 읽기 전용 (117)

실행자 권한으로 돌므로 anon 이 이 함수로 얻는 것은 테이블 권한·RLS 로 이미 얻을 수 있는 것과 같다. 처분 없음.

_get_adjacent_regions · add_toc_and_source · admin_godmode_categorize · alias_fragment_reason · alias_norm · alias_sigungu_set ·
apt_site_display_image · apt_sites_auto_variants(T) · apt_sites_sync_builder_normalized(T) · apt_stage_segment · blog_category_counts ·
blog_category_views · blog_popular_tags · build_smart_og_url · calculate_hot_score · check_issue_similarity · classify_h2_gate_level ·
classify_image_origin · derive_subscription_stage · enrich_apt_images_v2 · extract_complex_signature · extract_region_from_text ·
fmt_won_eok · fn_apt_pdf_false_success_guard(T) · fn_apt_site_enqueue_indexnow(T) · fn_apt_subscriptions_preserve_created_at(T) ·
fn_blog_group · fn_blog_match_apt_id · fn_blog_subcat_norm · fn_blog_sync_apt_region(T) · fn_indexnow_queue_default_urgent(T) ·
fn_indexnow_queue_status_safety(T) · fn_issue_alerts_lifecycle_ts(T) · gen_trade_table · generate_apt_name_variants_jsonb ·
generate_post_slug(T) · get_active_visitors · get_apt_archive · get_apt_complex_images · get_apt_complex_images_sorted ·
get_apt_dashboard_stats · get_apt_homepage_sections · get_apt_jeonse_trend · get_apt_landmark_paginated · get_apt_pipeline ·
get_apt_popular_paginated · get_apt_price_trend · get_apt_price_trend_monthly · get_apt_pulse · get_apt_recent_moves ·
get_apt_region_block_totals · get_apt_region_blocks · get_apt_region_counts · get_apt_site_images_sorted · get_apt_sites_needing_images ·
get_apt_subscription_hub · get_apt_unsold_paginated · get_backlink_targets · get_best_comment · get_blog_pulse_7d ·
get_blog_related_apt_sites · get_blog_sidebar_bundle · get_blog_sigungu_counts · get_blog_stats · get_bugyeong_weekly_trades ·
get_cron_summary · get_daily_gu_prices · get_daily_sector_stats · get_district_redev_digest · get_feed_pulse_7d ·
get_gichuk_trade_activity · get_home_region_options · get_home_spotlight · get_hot_topics · get_image_priority · get_llms_hub_counts ·
get_nearby_apt_compare · get_overused_apt_image_urls · get_poll_results · get_portfolio_summary · get_post_reactions ·
get_prediction_results · get_redev_count_by_region · get_region_realestate_summary · get_related_posts · get_stock_market_summary ·
get_stock_pulse · get_subscription_calendar · get_thin_blog_posts · get_trade_count_by_region · get_trade_region_stats ·
get_trending_searches · get_vs_results · get_weekly_stage_movers · get_weekly_trades · guard_hallucination_republish(T) · is_seed_user ·
map_redev_stage · match_apt_site · match_apt_sites_all · match_blog_to_apt_site · match_blog_to_stock_logo · normalize_builder ·
normalize_builder_name(T) · normalize_category · pick_apt_cover_image · resolve_external_citations · resolve_hub_url ·
safe_date_yyyymmdd · search_apt_transactions · search_kadeora_unified_v2 · search_kadeora_unified_v3 · set_updated_at(T) ·
slug_dup_key · url_decode · url_encode_korean · validate_blog_post_dry_run

## 7. 범위 밖 — 확장 소유 (225)

pgroonga 143 · **dblink 39** · pg_trgm 31 · hypopg 11 · index_advisor 1. 소유자 supabase_admin 이 부여한 권한이라 postgres 로는 회수 불가.
⚠️ dblink(dblink_connect·dblink_exec 등)가 anon 에 열려 있다 — 비슈퍼유저는 비밀번호 인증 연결만 가능하지만 공개 표면으로는 부적절. 확장을 `extensions` 스키마로 옮기거나 제거하는 별도 안건.
