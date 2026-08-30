-- get_apt_subscription_hub — «저장소 최초 등재 + 42703 수리» (2026-08-30 · Node 승인)
--
-- ══ 베이스라인 선언 ═══════════════════════════════════════════════════════
-- 이 함수는 지금까지 «채팅으로만» 관리돼 저장소에 정의가 없었다.
-- 그래서 오늘 같은 사고가 났을 때 「어느 판이 최신인가」를 아무도 답할 수 없었다.
-- 아래가 **기존 채팅 관리분의 최초 등재본**이며, 이후로는 «이 파일이 진실» 이다.
--
-- ⛔ 이 뒤로 DB 에서 직접 CREATE OR REPLACE 하지 않는다. 고칠 일이 생기면
--    이 파일을 고치고 마이그레이션으로 적용한다. 두 곳에서 고치면 다시 갈린다.
--
-- ══ 무엇이 틀려 있었나 ════════════════════════════════════════════════════
-- `shaped` CTE 가 «접두 없이» hero_license_tier 를 참조하는데, 그 값을 만드는
-- 경로가 어디에도 없었다. JSON 키만 추가되고 «값의 출처가 안 따라온» 것이다.
--   [apt/hub] rpc error: {"code":"42703","message":"column \"hero_license_tier\" does not exist"}
-- 데이터와 무관하게 «계획 단계» 에서 항상 실패한다 — /apt 청약 카드가 통째로 비어 있었고,
-- 페이지는 200 이라 조용했다.
--
-- ── 수리 (두 곳에 한 토큰씩) ──────────────────────────────────────────────
--   ① LATERAL:  ... a.builder, **a.hero_license_tier**
--   ② base 출력: ... AS builder,
--                **site.hero_license_tier**
-- ⚠️ ①만으로는 «안 고쳐진다». 맨 참조는 `shaped … FROM enriched e` 스코프라
--    LATERAL 별칭 site 가 보이지 않는다. base 가 한 번 내보내야
--    typed(b.*) → enriched(t.*) 를 타고 흘러 해소된다. 그래서 둘 다 넣었다.
--
-- ── 검증 (프로덕션 실측) ──────────────────────────────────────────────────
--   부산 counts={cards:17,...} · 전국 cards=30 · 첫 카드 hero_license_tier='confirmed'
--   md5(pg_get_functiondef) = 80e25c94abb48636358a6fe0d275d37f (이 파일과 «일치 확인»)
--
-- ⚠️ 정의 본문은 pg_get_functiondef 출력을 base64 로 받아 그대로 옮겼다.
--    손으로 옮겨 적지 않았다 — 옮겨 적는 순간 오타가 새 결함이 된다.
-- ⚠️ CREATE OR REPLACE 는 기존 GRANT 를 유지한다. 권한 구문을 여기 다시 적지 않는다
--    (적으면 그것이 또 하나의 «두 번째 진실» 이 된다).

CREATE OR REPLACE FUNCTION public.get_apt_subscription_hub(p_region text DEFAULT '전국'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_region text := NULLIF(btrim(coalesce(p_region,'')),'');
  v_timeline jsonb; v_cards jsonb; v_results jsonb; v_regions jsonb;
  v_window int; v_used_window int := 60;
  MIN_CARDS constant int := 6;
BEGIN
  IF v_region IS NULL OR v_region = '전국' THEN v_region := NULL; END IF;

  SELECT jsonb_agg(jsonb_build_object('region',r.region,'live',r.live,'recent',r.recent)
           ORDER BY r.live DESC, r.recent DESC, r.region) INTO v_regions
  FROM (SELECT s.region_nm AS region,
               count(*) FILTER (WHERE coalesce(s.rcept_endde,s.rcept_bgnde) >= v_today) AS live,
               count(*) FILTER (WHERE coalesce(s.cntrct_cncls_endde,s.przwner_presnatn_de,s.rcept_endde,s.rcept_bgnde) >= v_today - 60) AS recent
        FROM apt_subscriptions s WHERE s.region_nm IS NOT NULL GROUP BY s.region_nm) r;

  FOREACH v_window IN ARRAY ARRAY[60,180,365] LOOP
    v_used_window := v_window;
    WITH base AS (
      SELECT s.id, s.house_manage_no, s.house_nm, s.region_nm, s.supply_addr, s.pblanc_url,
        s.tot_supply_hshld_co AS households,
        coalesce(s.price_per_pyeong,s.price_per_pyeong_avg,s.price_per_pyeong_min) AS price_per_pyeong,
        s.rcept_bgnde, s.rcept_endde, s.spsply_rcept_bgnde, s.przwner_presnatn_de,
        s.cntrct_cncls_bgnde, s.cntrct_cncls_endde, s.competition_rate_1st, s.total_apply_count,
        LEAST(s.spsply_rcept_bgnde, s.rcept_bgnde) AS start_de,
        site.slug AS site_slug,
        coalesce(site.hero_image_url, case when site.lifecycle_stage in ('post_move_in','landmark_active') then site.satellite_image_url else null end, site.card_image_url, '/api/og-apt?slug=' || site.slug || '&ratio=1x1&card=1') AS thumb_url,
        coalesce(NULLIF(btrim(coalesce(s.constructor_nm,'')),''), site.builder) AS builder,
        site.hero_license_tier
      FROM apt_subscriptions s
      LEFT JOIN LATERAL (
        SELECT a.slug, a.hero_image_url, a.card_image_url, a.satellite_image_url, a.lifecycle_stage, a.builder, a.hero_license_tier
        FROM apt_sites a
        WHERE a.name = s.house_nm
        ORDER BY a.content_score DESC NULLS LAST
        LIMIT 1
      ) site ON true
      WHERE (v_region IS NULL OR s.region_nm = v_region)
        AND coalesce(s.cntrct_cncls_endde,s.przwner_presnatn_de,s.rcept_endde,s.rcept_bgnde) >= v_today - v_window
    ),
    typed AS (
      SELECT b.*, st.status,
        CASE st.status WHEN 'open' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'announced_wait' THEN 2
             WHEN 'contract' THEN 3 WHEN 'scheduled' THEN 4 WHEN 'leftover' THEN 5 ELSE 6 END AS weight,
        CASE st.status
          WHEN 'open' THEN b.rcept_endde - v_today
          WHEN 'upcoming' THEN b.start_de - v_today
          WHEN 'scheduled' THEN b.start_de - v_today
          WHEN 'announced_wait' THEN b.przwner_presnatn_de - v_today
          WHEN 'contract' THEN b.cntrct_cncls_endde - v_today
          ELSE NULL END AS dday
      FROM base b CROSS JOIN LATERAL (
        SELECT CASE
          WHEN b.house_nm ~ '(무순위|잔여세대|선착순|임의공급)' THEN 'leftover'
          WHEN b.rcept_endde >= v_today AND (b.start_de IS NULL OR b.start_de <= v_today) THEN 'open'
          WHEN b.start_de > v_today AND b.start_de <= v_today + 7 THEN 'upcoming'
          WHEN b.start_de > v_today THEN 'scheduled'
          WHEN b.przwner_presnatn_de >= v_today THEN 'announced_wait'
          WHEN b.cntrct_cncls_endde >= v_today THEN 'contract'
          ELSE 'closed' END AS status) st
    ),
    enriched AS (
      SELECT t.*, cr.best_rate, cr.total_applicants, cr.min_score FROM typed t
      LEFT JOIN LATERAL (SELECT max(c.competition_rate) AS best_rate, sum(c.applicant_count) AS total_applicants,
                                min((c.metadata->>'min_score')::numeric) AS min_score
                         FROM apt_competition_rates c WHERE c.subscription_id = t.id) cr ON true
    ),
    shaped AS (
      SELECT e.id, jsonb_build_object(
          'id',e.id,'house_manage_no',e.house_manage_no,'house_nm',e.house_nm,'region_nm',e.region_nm,
          'supply_addr',e.supply_addr,'households',e.households,'price_per_pyeong',e.price_per_pyeong,
          'rcept_bgnde',e.rcept_bgnde,'rcept_endde',e.rcept_endde,'spsply_rcept_bgnde',e.spsply_rcept_bgnde,
          'przwner_presnatn_de',e.przwner_presnatn_de,'cntrct_cncls_bgnde',e.cntrct_cncls_bgnde,
          'cntrct_cncls_endde',e.cntrct_cncls_endde,'status',e.status,'weight',e.weight,'dday',e.dday,
          'competition_rate',coalesce(e.best_rate,e.competition_rate_1st),
          'total_applicants',coalesce(e.total_applicants,e.total_apply_count),
          'min_score',e.min_score,'pblanc_url',e.pblanc_url,
          'site_slug',e.site_slug,'hero_license_tier', hero_license_tier, 'thumb_url',e.thumb_url,'builder',e.builder) AS item,
        e.status, e.weight, e.dday, e.rcept_endde
      FROM enriched e
    )
    SELECT
      coalesce((SELECT jsonb_agg(item ORDER BY weight, dday NULLS LAST, rcept_endde)
        FROM (SELECT * FROM shaped WHERE status IN ('open','upcoming','scheduled','announced_wait')
              ORDER BY weight, dday NULLS LAST, rcept_endde LIMIT 12) q), '[]'::jsonb),
      coalesce((SELECT jsonb_agg(item ORDER BY weight, dday NULLS LAST, rcept_endde DESC)
        FROM (SELECT * FROM shaped ORDER BY weight, dday NULLS LAST, rcept_endde DESC LIMIT 30) q), '[]'::jsonb),
      coalesce((SELECT jsonb_agg(item ORDER BY rcept_endde DESC, weight)
        FROM (SELECT * FROM shaped WHERE rcept_endde >= v_today - 7 AND rcept_endde < v_today
              ORDER BY rcept_endde DESC, weight LIMIT 20) q), '[]'::jsonb)
    INTO v_timeline, v_cards, v_results;

    EXIT WHEN jsonb_array_length(v_cards) >= MIN_CARDS;
  END LOOP;

  RETURN jsonb_build_object(
    'region', coalesce(v_region,'전국'),
    'requested_region', coalesce(NULLIF(btrim(coalesce(p_region,'')),''),'전국'),
    'region_empty', (jsonb_array_length(v_cards) = 0),
    'window_days', v_used_window,
    'today', v_today,
    'timeline', v_timeline, 'cards', v_cards, 'results', v_results,
    'regions', coalesce(v_regions,'[]'::jsonb),
    'counts', jsonb_build_object('timeline',jsonb_array_length(v_timeline),
                                 'cards',jsonb_array_length(v_cards),
                                 'results',jsonb_array_length(v_results)));
END;
$function$
