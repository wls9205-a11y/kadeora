-- H7-3b — 「백필은 움직임이 아니다」를 트리거 층에서 보장한다 (2026-08-28)
--
-- ══ 내가 오늘 만든 결함 ═════════════════════════════════════════════════════
-- H7-2 에서 `backfill_subscription_stages()` 를 만들며 「stage_updated_at 을 건드리지
-- 않는다」고 적었다. **틀렸다.** `apt_sites_stage_change` 트리거가
--   ① NEW.stage_updated_at := now()  ② apt_site_events 에 stage_change 삽입
-- 을 «무조건» 한다. 함수에서 그 컬럼을 안 써도 트리거가 덮는다.
--
-- 결과: 치유 140건이 2026-08-28 02:31:52 «한 시각으로» 이벤트를 쏟았고
--       홈 「최근 움직인 현장」이 그 교정분으로 덮였다 —
--       「move_in_ready → award_announced」 여섯 줄이 나란히.
--       8-27 백필(1,000건)이 만든 문제와 «똑같은 실패» 를 내가 반복했다.
--
-- ⚠️ 교훈: 「함수가 그 컬럼을 안 쓴다」는 「그 컬럼이 안 바뀐다」가 아니다.
--    쓰는 주체를 셀 때 «트리거» 를 빠뜨렸다(Rule #115 의 ② 항목이 정확히 이것이다).
--
-- ── 고치는 방식 ─────────────────────────────────────────────────────────────
-- 세션 GUC 로 「지금은 백필」임을 트리거에 알린다. 함수 수준 SET 이라 그 함수가
-- 도는 «동안만» 켜지고 끝나면 자동으로 돌아간다 — 켜 두고 잊을 수가 없다.

-- ── ① 트리거가 백필을 구분한다 ──────────────────────────────────────────────
create or replace function public.trg_apt_site_stage_change()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp' as $function$
DECLARE
  v_backfill boolean := coalesce(current_setting('kadeora.backfill', true), 'off') = 'on';
BEGIN
  IF NEW.lifecycle_stage IS DISTINCT FROM OLD.lifecycle_stage THEN
    NEW.previous_stage := OLD.lifecycle_stage;

    -- ⚠️ 백필이면 stage_updated_at 을 «건드리지 않는다». 값을 고친 날짜는
    --    현장이 움직인 날짜가 아니다. 호출자가 넣은 값이 있으면 그대로 둔다.
    IF NOT v_backfill THEN
      NEW.stage_updated_at := now();
    END IF;

    INSERT INTO apt_site_events (site_id, site_slug, event_type, from_value, to_value,
                                 confidence, source, occurred_at)
    VALUES (NEW.id, NEW.slug, 'stage_change', OLD.lifecycle_stage, NEW.lifecycle_stage,
            NEW.confidence,
            -- ⛔ 백필 이벤트는 «접두사로» 표시한다. 지우지 않는다 — 이력은 남기고,
            --    「최근 움직인」 같은 화면이 source 로 거를 수 있게 한다.
            case when v_backfill then 'backfill:' || coalesce(NEW.stage_source, 'unknown')
                 else coalesce(NEW.stage_source, 'unknown') end,
            now());
  END IF;
  RETURN NEW;
END;
$function$;

-- ── ② 백필 함수가 그 플래그를 켠다 ──────────────────────────────────────────
-- ⚠️ `alter function ... set kadeora.backfill` 은 «권한이 없다»
--    (permission denied to set parameter). set_config(.., is_local=true) 는 된다 —
--    같은 «트랜잭션» 안에서만 살아 있어 켜 두고 잊을 수가 없다. 그래서 plpgsql 로 바꾼다.
create or replace function public.backfill_subscription_stages(p_today date default current_date)
returns table(site_id uuid, from_stage text, to_stage text)
language plpgsql as $function$
BEGIN
  perform set_config('kadeora.backfill', 'on', true);   -- 이 트랜잭션 동안만
  return query
  with latest as (
    select distinct on (s.id)
           s.id, s.lifecycle_stage as cur,
           a.rcept_bgnde, a.rcept_endde, a.przwner_presnatn_de,
           a.cntrct_cncls_bgnde, a.cntrct_cncls_endde,
           case
             when s.move_in_date ~ '^\d{4}-\d{2}-\d{2}$' then s.move_in_date::date
             when s.move_in_date ~ '^\d{4}-\d{2}$'       then (s.move_in_date || '-01')::date
             when a.mvn_prearnge_ym ~ '^\d{6}$'
               then (substr(a.mvn_prearnge_ym,1,4) || '-' || substr(a.mvn_prearnge_ym,5,2) || '-01')::date
             else null
           end as move_in
      from apt_sites s
      join apt_subscriptions a on btrim(a.house_nm) = s.name
     where s.site_type = 'subscription'
       and (s.stage_source is null or s.stage_source = 'derived_subscription')
     order by s.id, a.rcept_bgnde desc nulls last
  ),
  calc as (
    select id, cur,
           derive_subscription_stage(rcept_bgnde, rcept_endde, przwner_presnatn_de,
                                     cntrct_cncls_bgnde, cntrct_cncls_endde, move_in, p_today) as nxt
      from latest
  ),
  upd as (
    update apt_sites s
       set lifecycle_stage = c.nxt,
           stage_source    = 'derived_subscription'
      from calc c
     where c.id = s.id and c.nxt is not null and c.nxt is distinct from c.cur
     returning s.id, c.cur, c.nxt
  )
  select id, cur, nxt from upd;
END;
$function$;

grant execute on function public.backfill_subscription_stages(date) to service_role;

-- ── ③ 이미 쌓인 백필 이벤트를 소급 표시 ────────────────────────────────────
-- 8-27 H6 백필 1,000건 · 8-28 H7-2 치유 140건. 둘 다 «한 시각에» 몰려 있어 구분된다.
-- ⛔ 지우지 않는다. source 만 바꿔 화면에서 빠지게 한다.
update apt_site_events
   set source = 'backfill:' || source
 where event_type = 'stage_change'
   and source = 'derived_subscription'
   and source not like 'backfill:%'
   and occurred_at::date in (date '2026-08-27', date '2026-08-28');

-- ── ④ 「최근 움직인 현장」이 백필·집계를 빼고 본다 ──────────────────────────
create or replace function public.get_apt_recent_moves(
  p_region text[] default null::text[], p_limit integer default 6, p_days integer default 14)
returns jsonb language plpgsql stable
set search_path to 'public', 'pg_temp' as $function$
DECLARE v jsonb;
BEGIN
  WITH ev AS (
    SELECT DISTINCT ON (e.site_id)
           e.site_id, e.from_value, e.to_value, e.confidence, e.occurred_at, e.source
    FROM apt_site_events e
    WHERE e.event_type = 'stage_change'
      AND e.occurred_at >= now() - make_interval(days => greatest(p_days,1))
      AND coalesce(e.source,'') NOT LIKE 'seed:%'
      -- H7-3b ⚠️ 백필은 «움직임이 아니다». 값을 고친 것과 현장이 움직인 것은 다르다.
      AND coalesce(e.source,'') NOT LIKE 'backfill:%'
    ORDER BY e.site_id, e.occurred_at DESC
  ),
  j AS (
    SELECT a.id, a.slug, coalesce(a.display_name, a.name) AS name, a.name AS raw_name,
           a.region, a.sigungu, a.lifecycle_stage, ev.from_value AS previous_stage,
           coalesce(a.complex_units, a.supply_units, a.total_units) AS total_units,
           a.supply_units, a.complex_units, a.hero_image_url, a.card_image_url,
           a.satellite_image_url, a.builder, a.hero_license_tier,
           coalesce(ev.confidence, a.confidence, 'confirmed') AS confidence,
           ev.occurred_at,
           CASE WHEN ev.from_value IS NULL THEN 'new' ELSE 'stage' END AS move_kind,
           CASE WHEN a.lifecycle_stage IN ('subscription_open','award_announced',
                                           'contract_signing','unsold_active','move_in_ready')
                THEN 0 ELSE 1 END AS line_rank
    FROM ev JOIN apt_sites a ON a.id = ev.site_id AND a.is_active
    WHERE a.content_score >= 40
      -- H7-3 ⛔ 이름 패턴(`name NOT LIKE '%미분양'`)을 «컬럼으로» 바꿨다.
      --        패턴은 데이터가 바뀌면 조용히 어긋난다.
      AND a.is_aggregate = false
      -- H7-3 ⚠️ 언제 움직였는지 모르면 「움직였다」고 말하지 않는다.
      AND a.stage_updated_at IS NOT NULL
      AND a.lifecycle_stage NOT IN ('post_move_in','active_trade','landmark_active')
      AND (p_region IS NULL OR a.region = ANY(p_region))
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'slug', slug, 'name', name, 'raw_name', raw_name,
      'region', region, 'sigungu', sigungu,
      'lifecycle_stage', lifecycle_stage, 'previous_stage', previous_stage,
      'move_kind', move_kind, 'line_rank', line_rank,
      'total_units', total_units, 'supply_units', supply_units, 'complex_units', complex_units,
      'builder', builder, 'confidence', confidence,
      'hero_license_tier', hero_license_tier,
      'thumb_url', coalesce(hero_image_url, card_image_url, satellite_image_url),
      'occurred_at', occurred_at
    ) ORDER BY CASE move_kind WHEN 'stage' THEN 0 ELSE 1 END, line_rank, occurred_at DESC), '[]'::jsonb)
  INTO v FROM (
    SELECT * FROM j
    ORDER BY CASE move_kind WHEN 'stage' THEN 0 ELSE 1 END, line_rank, occurred_at DESC
    LIMIT greatest(p_limit,1)
  ) x;
  RETURN v;
END;
$function$;
