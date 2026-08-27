-- A1 — 시드 격리 · 죽은 크론 정지 · KPI 정합 (2026-08-27)
--
-- ⚠️ 이 파일은 «이미 프로덕션에 적용된» 내용의 기록이다. 재실행해도 안전하도록 썼다.
--    Supabase MCP execute_sql 은 다중문에서 마지막 결과만 돌려주므로 한 문장씩 돌렸다.
--
-- ── 왜 ───────────────────────────────────────────────────────────────────────
-- 시드 계정 505개가 글 2,405 · 댓글 3,886 을 갖고 있고, 실사용자 171명의 30일 글은
-- «0건 · 댓글 0건» 이다. 그런데 KPI 는 활발해 보였다. 지표가 우리 자신을 세고 있었다.
-- 실측: mv_community_feed_hot 의 「인기 글」 200건이 «전부» 시드 글이었다 (교체 후 0건).

-- ① 죽은 이미지 크론 7개 정지 (pg_cron)
--    jobid 만 보고 끄면 엉뚱한 걸 끈다. jobname 을 대조하고 껐다.
--      54 blog-image-supplement · 85 naver-hotlink-migrate · 98 image-relevance-check
--     101 image-relevance-replace · 104 unsplash-fetch · 105 blog-cover-auto-enhance
--     108 blog-inject-images
-- select cron.unschedule(jobid);  -- 7회, 이후 count = 0 확인함

-- ② hot_posts_v2 — 시드 제외
-- ⚠️ `= false` 가 아니라 `IS NOT TRUE`. is_seed 는 nullable 이고,
--    NOT (NULL = false) = NULL 이라 `= false` 는 null 인 실사용자를 통째로 거른다.
create or replace view public.hot_posts_v2 with (security_invoker=true) as
 SELECT p.id, p.author_id, p.category, p.region_id, p.city, p.title, p.content,
    p.is_anonymous, p.likes_count, p.comments_count, p.report_count, p.tag,
    p.stock_tags, p.images, p.is_deleted, p.created_at, p.updated_at, p.apt_tags,
    p.downvotes_count, p.view_count, p.room_id, p.slug,
    pr.nickname, pr.avatar_url, pr.grade, pr.grade_title, pr.influence_score,
    p.likes_count - p.downvotes_count AS net_score,
    calculate_hot_score(p.likes_count, p.downvotes_count, p.created_at) AS hot_score
   FROM posts p JOIN profiles pr ON p.author_id = pr.id
  WHERE p.is_deleted = false
    AND p.created_at > (now() - '7 days'::interval)
    AND pr.is_seed IS NOT TRUE
  ORDER BY (calculate_hot_score(p.likes_count, p.downvotes_count, p.created_at)) DESC;

-- ③ mv_community_feed_hot — matview 라 drop + create.
--    NOT EXISTS 로 건다. JOIN 을 추가하면 행이 늘어날 수 있다.
--    ⚠️ UNIQUE 인덱스를 반드시 복구할 것 — 없으면 REFRESH ... CONCURRENTLY 가 실패한다.
drop materialized view if exists public.mv_community_feed_hot;
create materialized view public.mv_community_feed_hot as
 SELECT p.id, p.title, "left"(p.content, 200) AS content_preview, p.category, p.slug,
    p.author_id, p.created_at, p.view_count, p.likes_count, p.comments_count,
    COALESCE(p.likes_count,0)*3 + COALESCE(p.comments_count,0)*5 + LEAST(COALESCE(p.view_count,0),1000)
      + CASE WHEN p.created_at >= (now() - '24:00:00'::interval) THEN 100 ELSE 0 END
      + CASE WHEN p.created_at >= (now() - '7 days'::interval)   THEN 50  ELSE 0 END AS hot_score
   FROM posts p
  WHERE p.is_deleted = false AND p.is_hidden = false
    AND p.created_at >= (now() - '30 days'::interval)
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = p.author_id AND pr.is_seed)
  ORDER BY 11 DESC
  LIMIT 200;
create unique index idx_mv_community_feed_hot_id  on public.mv_community_feed_hot (id);
create index        idx_mv_community_feed_hot_cat on public.mv_community_feed_hot (category, hot_score desc);
grant all on public.mv_community_feed_hot to anon, authenticated, service_role;

-- ④ v_admin_dashboard_v2 — signups 가 시드 505 를 세고 있었다
--    (전문은 프로덕션 정의 참조. daily_users CTE 에 아래 한 줄을 추가했다)
--      AND profiles.is_seed IS NOT TRUE

-- ⑤ 시드 인구통계 NULL 화 — 505건, age 501 / gender 500 / region 502 → 0
--    실사용자 171명의 값은 그대로다(age 24 · region 46).
update profiles set age_group=null, gender=null, region_text=null where is_seed;

-- ⑥ v_seo_daily_snapshot
--    · issue_primary_30d 신설 — 이슈 중 1차 소스 비율. 지금 0.0. Phase B3 의 목표 지표.
--    · ⚠️ signups_7d 가 `is_seed = false` 였다. 지금 null 이 0건이라 값은 같지만
--      is_seed 는 nullable 이고 기본값에만 의존한다. `IS NOT TRUE` 로 바꿔 뒀다.
--    · blog_with_site_30d 는 «여기서 못 만든다» — blog_posts.apt_site_id 가 A5(#4)에서
--      생긴다. 없는 컬럼을 참조하는 뷰는 만들 수 없고, 0 을 하드코딩하면 거짓말이 된다.
--      A5 커밋에서 추가한다.

-- ══ A2 (2026-08-27) — 관찰 ══════════════════════════════════════════════════
-- ai_failed 1,901건(30일)이 «왜» 실패했는지 기록이 없었다. 5분류를 남긴다.
alter table issue_alerts add column if not exists fail_reason text;
comment on column issue_alerts.fail_reason is
  'A2(2026-08-27) 초안 실패 5분류: model_error·parse·token_limit·duplicate·no_match.';
-- 관찰 기준선 (30일, 2026-08-27)
--   ai_failed 1901 · draft 452 · failed 249 · auto_failed 196 · auto 151 · duplicate_blog 84
