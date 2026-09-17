-- B3 ⑶ 공개 RPC 전수 정합화 — «의도 아님» 67종 revoke (2026-09-17)
-- 대장: docs/security/rpc_public_allowlist_2026-09-17.md
--
-- 전수: public 스키마 함수 중 anon 또는 authenticated EXECUTE 보유 459 (확장 소유 225 · 비확장 234).
-- 분류 규칙: 앱 호출 0 ∧ (쓰기 ∨ SECURITY DEFINER) → revoke. 앱 호출이 있거나 애매하면 존치.
--   앱 호출 판정 = worktree(origin/main a6397ec8) 전체 git grep 에서 따옴표 리터럴 이름 0건
--               (src/types/database.ts · migrations · docs · *.md 제외) + 메인 체크아웃 작업 트리 동일 0건
--               + edge_logs 최근 24h /rest/v1/rpc/<이름> 호출 0건(긍정 대조: fn_region_sale_counts 등 1,245건 잡힘).
--   DB 내부 의존 = 다른 함수 본문·뷰·MV·RLS 정책·컬럼 기본값·cron.job 명령 전수 대조:
--     · get_apt_{fresh,imminent,redev}_cascade ← get_apt_unified_carousel(DEFINER) · get_apt_site_page ← get_apt_subscription_page(DEFINER)
--       → 호출자가 DEFINER(postgres 실행)라 revoke 영향 없음.
--     · site_uptime_probe ← cron job 173 (username=postgres, */5 * * * * GMT = KST 동일 5분 주기) → 영향 없음.
--     · 트리거 함수 7종(fn_lead_new_alert·fn_log_apt_change·handle_post_like·increment_discussion_messages_count·
--       log_apt_active_change·trg_apt_site_stage_change·trg_bpi_reset_quality_checked_at)은 발화 시 EXECUTE 검사를 하지 않는다 → 영향 없음.
--   존치로 뺀 것(앱 호출 0 이지만): is_current_user_admin(RLS 정책 6곳이 호출자 권한으로 평가) ·
--     fn_insert_lead(외부 Apps Script 가 anon 으로 호출 — 애매) · get_my_access_level·get_stock_gate_config(앱 호출: (sb.rpc as any)(…) 형태라 1차 grep 누락).
--
-- 적용 전 ACL: 58종 {=X,postgres,anon,authenticated,service_role} · 5종 {postgres,anon,authenticated,service_role}
--             · 3종 {postgres,authenticated,service_role}(deduct_points×2·increment_user_likes) · 1종 log_teaser_debug(순서만 다름)
-- 과거 명시 GRANT(anon/authenticated) 이력이 있던 것 37종 — 당시 소비자(캐러셀·홈 v2 등)가 코드에서 사라졌다. 대장에 버전 표기.
-- 되돌리기: GRANT EXECUTE ON FUNCTION <sig> TO anon, authenticated;

DO $$
DECLARE
  sigs text[] := ARRAY[
    'public.apt_region_recent_change(text,integer)',
    'public.backfill_subscription_stages(date)',
    'public.blog_category_stats()',
    'public.check_nickname_available(text)',
    'public.deduct_points(uuid,integer,text,jsonb)',
    'public.deduct_points(uuid,integer)',
    'public.fn_lead_new_alert()',
    'public.fn_log_apt_change()',
    'public.get_apt_3y_trend(uuid)',
    'public.get_apt_complex_stage6(text)',
    'public.get_apt_fresh_cascade(text,integer)',
    'public.get_apt_imminent_cascade(text,integer)',
    'public.get_apt_redev_cascade(text,integer)',
    'public.get_apt_site_page(text)',
    'public.get_apt_sites_with_thumbnails(text,text,integer,integer,text)',
    'public.get_apt_subscription_page(text)',
    'public.get_apt_transactions_with_thumbnails(integer,integer,text,text)',
    'public.get_apt_unified_carousel(text)',
    'public.get_blog_category_stats()',
    'public.get_blog_related_posts(bigint,integer)',
    'public.get_blog_teaser_config()',
    'public.get_carousel_active_subscriptions(integer)',
    'public.get_carousel_calc_topic(text,integer,integer)',
    'public.get_carousel_hot_redevelopment(integer)',
    'public.get_carousel_related_blogs(text,text,integer)',
    'public.get_carousel_related_complexes(text,integer)',
    'public.get_carousel_same_sector_stocks(text,integer)',
    'public.get_carousel_similar_complexes(text,integer)',
    'public.get_carousel_top_stocks(text,text,integer)',
    'public.get_homepage_hero()',
    'public.get_homepage_v2_fast()',
    'public.get_hot_apt_complexes(text,integer)',
    'public.get_hot_polls(integer)',
    'public.get_hot_posts_by_region(text,integer)',
    'public.get_hot_posts_with_images(integer,integer)',
    'public.get_issue_config(text)',
    'public.get_magnet_content(integer,integer)',
    'public.get_main_page_data(text)',
    'public.get_onboarding_value_content()',
    'public.get_region_apt_stats()',
    'public.get_rent_stats(text,integer)',
    'public.get_sidebar_widgets(text)',
    'public.get_stock_dashboard()',
    'public.get_stock_related_blogs(text,integer)',
    'public.get_stocks_with_thumbnails(text,integer,integer,text)',
    'public.handle_post_like()',
    'public.increment_apt_view(text)',
    'public.increment_banner_click(bigint)',
    'public.increment_banner_impression(bigint)',
    'public.increment_calc_result_share(text)',
    'public.increment_calc_result_view(text)',
    'public.increment_discussion_messages_count()',
    'public.increment_likes(bigint)',
    'public.increment_popup_click(integer)',
    'public.increment_post_view(bigint)',
    'public.increment_user_likes(uuid,integer)',
    'public.increment_view_count(bigint,uuid)',
    'public.log_apt_active_change()',
    'public.log_teaser_debug(text,text,jsonb)',
    'public.mark_all_notifications_read(uuid)',
    'public.resort_gated_by_attractiveness(bigint)',
    'public.safe_search_posts(text,integer)',
    'public.site_uptime_probe()',
    'public.strip_external_body_images(bigint,text)',
    'public.trg_apt_site_stage_change()',
    'public.trg_bpi_reset_quality_checked_at()',
    'public.update_series_count(text)'
  ];
  s text;
  bad int := 0;
  remain int;
BEGIN
  IF cardinality(sigs) <> 67 THEN RAISE EXCEPTION 'B3 revoke 대상 수 불일치: %', cardinality(sigs); END IF;
  FOREACH s IN ARRAY sigs LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', s::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', s::regprocedure);
  END LOOP;

  FOREACH s IN ARRAY sigs LOOP
    IF has_function_privilege('anon', s, 'EXECUTE')
       OR has_function_privilege('authenticated', s, 'EXECUTE')
       OR NOT has_function_privilege('service_role', s, 'EXECUTE')
       OR NOT has_function_privilege('postgres', s, 'EXECUTE') THEN
      bad := bad + 1;
    END IF;
  END LOOP;
  IF bad <> 0 THEN RAISE EXCEPTION 'B3 revoke ACL 불일치: % 종', bad; END IF;

  -- 비확장 공개 함수: 적용 전 234 → 기대 167
  SELECT count(*) INTO remain
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF remain <> 167 THEN RAISE EXCEPTION 'B3 잔존 공개 함수 수 불일치: % (기대 167)', remain; END IF;

  -- 존치 표본(앱 호출 경로) 이 닫히지 않았는지 긍정 확인
  IF NOT has_function_privilege('anon', 'public.get_social_proof_counts()', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.fn_insert_lead(text,text,text,text,text,text,text,text,integer,jsonb,boolean,text,text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_current_user_admin()', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.get_stock_gate_config(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'B3 존치 표본이 닫힘';
  END IF;
END $$;
