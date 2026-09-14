-- NW-1 v2 (설계서_NW_20260913 v1.4) — 정비 원천 단계 → lifecycle_stage 동기화
--
-- ── 왜 ──────────────────────────────────────────────────────────────────────
-- sync-apt-sites 는 redevelopment_projects.stage 를 source_ids.redev_stage 에만 복사하고
-- lifecycle_stage 로는 옮기지 않았다. 그래서 원천이 「준공」인 구역이 site_planning 으로
-- 노출됐다(부산 24 · 경기 220 은 NULL). 정본 매퍼 map_redev_stage() 는 이미 있었다.
--
-- ⛔ 기록 대상 = stage_source IS NULL 이거나 «이 함수가 쓴» 행('redev:%') · stage_locked 아님.
--    사람(admin)·DART·permit·crawl 이 쓴 값은 건드리지 않는다(H7-2).
-- ⛔ 매퍼가 NULL(해제·조합해산·미지 단계)이면 쓰지 않고 review 목록으로 «반환만» 한다.
-- ⚠️ p_backfill=true 는 «밀린 값의 교정» 이다. 트리거가 이벤트 source 에 'backfill:' 을 붙여
--    「이번 주 움직인 현장」·주간 이동 글에서 빠진다. 매일 회전(원천이 실제로 움직인 것)은 false.

CREATE OR REPLACE FUNCTION public.sync_redev_lifecycle(
  p_regions  text[],
  p_dry      boolean DEFAULT true,
  p_backfill boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_apply   jsonb;
  v_review  jsonb;
  v_n_apply int := 0;
  v_n_rev   int := 0;
  v_written int := 0;
BEGIN
  IF p_regions IS NULL OR cardinality(p_regions) = 0 THEN
    RAISE EXCEPTION 'sync_redev_lifecycle: p_regions 필수 — 전국 일괄은 막는다';
  END IF;

  -- 같은 트랜잭션에서 두 번 부르면(dry → 실행) ON COMMIT DROP 전이라 이름이 겹친다.
  DROP TABLE IF EXISTS _nw1;
  CREATE TEMP TABLE _nw1 ON COMMIT DROP AS
  SELECT a.id, a.slug, a.region, a.dong, a.lifecycle_stage AS cur,
         coalesce(a.complex_units, a.total_units) AS units,
         r.stage AS src_stage, r.source AS src, r.external_code, r.id AS redev_id,
         r.district_name,
         public.map_redev_stage(r.stage) AS mapped
  FROM apt_sites a
  JOIN redevelopment_projects r ON r.id::text = a.source_ids->>'redev_id'
  WHERE a.is_active
    AND a.region = ANY (p_regions)
    AND (a.stage_source IS NULL OR a.stage_source LIKE 'redev:%')
    AND coalesce(a.stage_locked, false) = false;

  -- 적용 목록. evidence_site 는 «경보» 다(구 3신호 합의의 격하형) — 전환을 막지 않는다.
  SELECT count(*),
         coalesce(jsonb_agg(jsonb_build_object(
           'slug', t.slug, 'region', t.region, 'from', t.cur, 'to', t.mapped,
           'src_stage', t.src_stage, 'redev_key', t.external_code,
           'evidence_site', CASE WHEN t.mapped = 'post_move_in' THEN (
               SELECT s.slug FROM apt_sites s
               WHERE s.is_active AND s.lifecycle_stage = 'post_move_in' AND s.id <> t.id
                 AND s.region = t.region AND s.dong = t.dong AND t.units IS NOT NULL
                 AND abs(coalesce(s.complex_units, s.total_units) - t.units)::numeric
                     / greatest(t.units, 1) <= 0.10
               LIMIT 1) END
         ) ORDER BY t.region, t.slug), '[]'::jsonb)
  INTO v_n_apply, v_apply
  FROM _nw1 t
  WHERE t.mapped IS NOT NULL AND t.mapped IS DISTINCT FROM t.cur;

  SELECT count(*),
         coalesce(jsonb_agg(jsonb_build_object(
           'slug', t.slug, 'region', t.region, 'cur', t.cur,
           'src_stage', t.src_stage, 'redev_key', t.external_code
         ) ORDER BY t.region, t.slug), '[]'::jsonb)
  INTO v_n_rev, v_review
  FROM _nw1 t
  WHERE t.mapped IS NULL;

  IF NOT p_dry THEN
    IF p_backfill THEN
      PERFORM set_config('kadeora.backfill', 'on', true);  -- 이 트랜잭션 동안만
    END IF;

    UPDATE apt_sites a
       SET lifecycle_stage = t.mapped,
           stage_source    = 'redev:' || coalesce(t.src, 'unknown'),
           updated_at      = now()
      FROM _nw1 t
     WHERE a.id = t.id AND t.mapped IS NOT NULL AND t.mapped IS DISTINCT FROM t.cur;
    GET DIAGNOSTICS v_written = ROW_COUNT;

    IF p_backfill THEN
      PERFORM set_config('kadeora.backfill', 'off', true);
    END IF;

    -- ⛔ review 목록을 apt_stage_review_queue 에 넣지 «않는다».
    --    그 큐의 승인 버튼(/api/admin/redev-review)은 applyConstructorSelected 를 부른다 —
    --    승인하는 순간 현장이 constructor_selected·confirmed·stage_source='dart' 로 덮인다.
    --    DART 전용 의미라 해제·조합해산 건을 거기 넣으면 사람이 «옳게 누른 것이 오기록» 이 된다.
    --    review 는 반환값(→ 호출 라우트의 cron_logs.metadata)으로만 남긴다.
  END IF;

  RETURN jsonb_build_object(
    'dry', p_dry, 'backfill', p_backfill, 'regions', to_jsonb(p_regions),
    'scanned', (SELECT count(*) FROM _nw1),
    'apply_count', v_n_apply, 'review_count', v_n_rev,
    'written', v_written,
    'apply', v_apply, 'review', v_review);
END;
$function$;

-- 쓰기 함수다. 서버(service_role)만 부른다.
REVOKE ALL ON FUNCTION public.sync_redev_lifecycle(text[], boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_redev_lifecycle(text[], boolean, boolean) TO service_role;

-- 주간 이동 글 — get_apt_recent_moves(H7-3b)와 같은 규칙: 백필은 «움직임이 아니다».
-- ⚠️ 지금까지 이 RPC 는 'seed:%' 만 걸렀다. NW-1 교정분(backfill)이 「이번 주 준공 24곳」으로 나갈 뻔했다.
CREATE OR REPLACE FUNCTION public.get_weekly_stage_movers(p_region text DEFAULT '부울경'::text, p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v jsonb; v_total int; v_conf int; v_new int;
        v_region text := NULLIF(btrim(coalesce(p_region,'')),'');
BEGIN
  IF v_region = '전국' THEN v_region := NULL; END IF;

  WITH ev AS (
    SELECT DISTINCT ON (e.site_id)
           e.site_id, e.from_value, e.to_value, e.confidence, e.source, e.note, e.occurred_at
    FROM apt_site_events e
    WHERE e.event_type = 'stage_change'
      AND e.occurred_at >= now() - make_interval(days => greatest(p_days,1))
      -- ⚠️ from_value NULL 은 신규 등록이지 단계 이동이 아니다
      AND e.from_value IS NOT NULL
      AND e.from_value <> e.to_value
      -- 대량 시드는 '움직임'이 아니다
      AND coalesce(e.source,'') NOT LIKE 'seed:%'
      -- NW-1 ⚠️ 백필(밀린 값 교정)도 움직임이 아니다
      AND coalesce(e.source,'') NOT LIKE 'backfill:%'
    ORDER BY e.site_id, e.occurred_at DESC
  ),
  j AS (
    SELECT ev.*, a.slug, a.name, a.display_name, a.region, a.sigungu, a.builder,
           a.supply_units, a.complex_units, a.hero_image_url, a.name_variants, a.lifecycle_stage
    FROM ev JOIN apt_sites a ON a.id = ev.site_id AND a.is_active
    WHERE ( v_region IS NULL
            OR (v_region = '부울경' AND a.region IN ('부산','울산','경남'))
            OR a.region = v_region )
  )
  SELECT count(*), count(*) FILTER (WHERE confidence = 'confirmed'),
         coalesce(jsonb_agg(jsonb_build_object(
           'slug', slug, 'name', coalesce(display_name, name),
           'region', region, 'sigungu', sigungu,
           'from_stage', from_value, 'to_stage', to_value, 'stage', lifecycle_stage,
           'builder', builder, 'supply_units', supply_units, 'complex_units', complex_units,
           'has_image', hero_image_url IS NOT NULL,
           'confidence', coalesce(confidence,'confirmed'),
           'source', source, 'note', note, 'occurred_at', occurred_at, 'variants', name_variants
         ) ORDER BY
             CASE coalesce(confidence,'confirmed') WHEN 'confirmed' THEN 0
                  WHEN 'estimated' THEN 1 ELSE 2 END,
             occurred_at DESC), '[]'::jsonb)
  INTO v_total, v_conf, v FROM j;

  -- 참고: 같은 기간 신규 등록 수(글에 「신규 등록 N곳」으로 별도 표기 가능)
  SELECT count(DISTINCT e.site_id) INTO v_new
  FROM apt_site_events e JOIN apt_sites a ON a.id = e.site_id AND a.is_active
  WHERE e.event_type='stage_change' AND e.from_value IS NULL
    AND e.occurred_at >= now() - make_interval(days => greatest(p_days,1))
    AND ( v_region IS NULL OR (v_region='부울경' AND a.region IN ('부산','울산','경남')) OR a.region=v_region );

  RETURN jsonb_build_object(
    'region', coalesce(v_region,'전국'), 'days', p_days,
    'total', coalesce(v_total,0), 'confirmed', coalesce(v_conf,0),
    'newly_registered', coalesce(v_new,0),
    'publishable', coalesce(v_total,0) >= 3,
    'items', v);
END;
$function$;
