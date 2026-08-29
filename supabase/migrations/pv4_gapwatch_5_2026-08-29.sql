-- PV-4 — 갭워치 5지표를 v_seo_daily_snapshot 에 얹는다 (2026-08-29)
--
-- ⚠️ 지표를 «만들면서» 둘을 실측으로 고쳤다. 설계대로 짰으면 둘 다 «거짓 0» 이었다.
--
-- ── ④ 중복 후보 — 완전일치로는 «0 이 나온다» ────────────────────────────────
-- 정규화 후 완전일치로 재면 0 이다(실측). 실제 중복은 접미가 붙는 형태다:
--   「은마아파트 재건축 ↔ 은마아파트」 「개포주공1단지 재건축 ↔ 개포주공1단지」
-- → 같은 (시군구, 법정동) 안에서 «포함 관계» 로 잡는다. 134쌍.
-- ⛔ 이건 «검수 큐» 다 — 사람이 보는 목록이지 자동 반영이 아니다. 그래서 포함이 타당하다.
--    (키워드→현장 «자동» 매칭에서 포함·유사도를 금지한 것과 목적이 다르다.)
--
-- ── ⑤ 단계 정체 — 측정 «불가» 하면 0 이 아니라 NULL ─────────────────────────
-- stage_updated_at 은 「단계가 마지막으로 바뀐 시각」이 아니었다. 2026-08 에 일괄
-- 세팅된 값이다 — 최고령 2026-08-03, 그리고 206건이 2026-08-24 «하루» 에 몰려 있다.
-- 그대로 180일 컷을 재면 앞으로 180일간 «무조건 0» 이고, 그 0 은 「정체가 없다」로
-- 읽힌다. 사실은 「아직 못 잰다」다.
-- → 바닥(min)이 180일을 넘기 전에는 NULL 을 내고, pv_stage_ts_floor 로 그 이유를
--   «숫자로» 함께 보여 준다. NULL 은 모른다는 뜻이고 0 은 없다는 뜻이다 — 오늘의 공리.
create or replace view v_seo_daily_snapshot as
 SELECT CURRENT_DATE AS d,
    (SELECT count(*) FROM gsc_search_analytics WHERE date >= (CURRENT_DATE - 7)) AS gsc_rows_7d,
    (SELECT COALESCE(sum(impressions), 0::bigint) FROM gsc_search_analytics WHERE date >= (CURRENT_DATE - 7)) AS gsc_impr_7d,
    (SELECT COALESCE(sum(clicks), 0::bigint) FROM gsc_search_analytics WHERE date >= (CURRENT_DATE - 7)) AS gsc_clicks_7d,
    (SELECT max(date) FROM gsc_search_analytics) AS gsc_last_date,
    (SELECT count(*) FROM keyword_rank_daily WHERE date = CURRENT_DATE AND source = 'webkr' AND rank IS NOT NULL) AS naver_web_ranked,
    (SELECT count(*) FROM keyword_rank_daily WHERE date = CURRENT_DATE AND source = 'blog' AND rank IS NOT NULL) AS naver_blog_ranked,
    (SELECT count(*) FROM leads WHERE created_at >= (CURRENT_DATE - 7)) AS leads_7d,
    (SELECT count(*) FROM leads WHERE status = 'new') AS leads_unhandled,
    (SELECT count(*) FROM profiles WHERE is_seed IS NOT TRUE AND created_at >= (CURRENT_DATE - 7)) AS signups_7d,
    (SELECT round(100.0 * count(*) FILTER (WHERE source_type ~~ like_escape('primary!_%','!'))::numeric / NULLIF(count(*),0)::numeric, 1)
       FROM issue_alerts WHERE created_at >= (now() - '30 days'::interval)) AS issue_primary_30d,
    (SELECT round(100.0 * count(*) FILTER (WHERE apt_site_id IS NOT NULL)::numeric / NULLIF(count(*),0)::numeric, 1)
       FROM blog_posts WHERE is_published AND category = 'apt' AND COALESCE(published_at, created_at) >= (now() - '30 days'::interval)) AS blog_with_site_30d,
    (SELECT count(*) FROM apt_sites WHERE is_active IS NOT FALSE AND lifecycle_stage = 'pre_announcement') AS pv_pre_announcement,
    (SELECT count(*) FROM apt_permits WHERE matched_site_id IS NULL) AS pv_permit_unmatched,
    (SELECT count(*) FROM apt_sites WHERE is_active IS NOT FALSE AND confidence = 'conflicting') AS pv_conflicting,
    (SELECT count(*) FROM (
        SELECT 1 FROM apt_sites a JOIN apt_sites b
          ON a.sigungu = b.sigungu AND a.dong = b.dong AND a.id < b.id
        WHERE a.is_active IS NOT FALSE AND b.is_active IS NOT FALSE AND a.dong IS NOT NULL
          AND length(regexp_replace(lower(coalesce(a.display_name,a.name)),'[^0-9a-z가-힣]','','g')) >= 3
          AND length(regexp_replace(lower(coalesce(b.display_name,b.name)),'[^0-9a-z가-힣]','','g')) >= 3
          AND (regexp_replace(lower(coalesce(a.display_name,a.name)),'[^0-9a-z가-힣]','','g')
                 LIKE '%' || regexp_replace(lower(coalesce(b.display_name,b.name)),'[^0-9a-z가-힣]','','g') || '%'
            OR regexp_replace(lower(coalesce(b.display_name,b.name)),'[^0-9a-z가-힣]','','g')
                 LIKE '%' || regexp_replace(lower(coalesce(a.display_name,a.name)),'[^0-9a-z가-힣]','','g') || '%')
      ) z) AS pv_dupe_pairs,
    (SELECT CASE WHEN min(stage_updated_at) < now() - '180 days'::interval
                 THEN count(*) FILTER (WHERE stage_updated_at < now() - '180 days'::interval)
            END
       FROM apt_sites
      WHERE is_active IS NOT FALSE
        AND lifecycle_stage IN ('union_established','constructor_selected','award_pending',
                                'award_announced','plan_approved','mgmt_approved')) AS pv_stage_stalled,
    (SELECT min(stage_updated_at)::date FROM apt_sites
      WHERE lifecycle_stage IN ('union_established','constructor_selected','award_pending',
                                'award_announced','plan_approved','mgmt_approved')) AS pv_stage_ts_floor;

grant select on v_seo_daily_snapshot to service_role;

-- ══ 재현 쿼리 (부록 A-3 형태) ═══════════════════════════════════════════════
-- 지표 한 줄로 보기:
--   select pv_pre_announcement, pv_permit_unmatched, pv_conflicting,
--          pv_dupe_pairs, pv_stage_stalled, pv_stage_ts_floor
--     from v_seo_daily_snapshot;
--
-- ④ 중복 후보 «목록» (검수 큐로 꺼낼 때):
--   with n as (select id, sigungu, dong, coalesce(display_name,name) nm,
--                     regexp_replace(lower(coalesce(display_name,name)),'[^0-9a-z가-힣]','','g') norm
--                from apt_sites where is_active is not false and dong is not null)
--   select a.nm, b.nm, a.sigungu, a.dong from n a join n b
--     on a.sigungu=b.sigungu and a.dong=b.dong and a.id<b.id
--   where length(a.norm)>=3 and length(b.norm)>=3
--     and (a.norm like '%'||b.norm||'%' or b.norm like '%'||a.norm||'%');
--
-- ⑤ 가 언제부터 의미를 갖는가: pv_stage_ts_floor + 180일 이후.
--
-- 실측 초기값(2026-08-29): 27 / 988 / 1 / 134 / NULL(바닥 2026-08-03)
