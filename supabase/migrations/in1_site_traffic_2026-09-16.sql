-- IN-0ⓐ 검색량 적재처 + IN-1 현장별 유입 실측 뷰 (2026-09-16)
--
-- 왜 이 파일이 하나인가: IN-2 Tier 판정의 «단일 재료» 를 만드는 것이 목적이고,
-- 그 재료는 「방문 × 네이버 유입 × 검색량」 세 축이 한 행에 모여야 성립한다.
-- 검색량 열이 없으면 뷰가 그 축을 NULL 로도 못 들고 있는다.
--
-- ⛔ 이 뷰를 쓰기 전에 반드시 알아야 하는 함정 두 개 (2026-09-16 실측에서 실제로 밟았다):
--
--   ① page_views.path 는 «퍼센트 인코딩» 이고 apt_sites.slug 는 «한글 원문» 이다.
--      그냥 조인하면 6,314 행 중 «2행» 만 붙는다. 붙은 2행만 보고 「유입이 거의 없다」로
--      읽으면 통째로 틀린다. url_decode() 를 반드시 통과시킨다.
--
--   ② 검색량 NULL 은 «0 이 아니라 미측정» 이다.
--      T-γ 경계는 「검색량 0」인데, IN-0ⓐ 적재 전에는 전 행이 NULL 이다.
--      NULL 을 0 으로 읽으면 6,000 페이지가 통째로 T-γ 로 떨어진다.
--      그래서 뷰가 volume_measured 깃발을 «따로» 들고 나간다. 이 깃발이 false 인 행은
--      Tier 판정 대상이 아니다 (DS_RULES 「못 재는 것은 초록이 아니라 미측정」).

-- ─────────────────────────────────────────────────────────────
-- 1. IN-0ⓐ — 검색량 적재처 (네이버 검색광고 RelKwdStat)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE keyword_rank_targets
  ADD COLUMN IF NOT EXISTS volume_pc         integer,
  ADD COLUMN IF NOT EXISTS volume_mobile     integer,
  ADD COLUMN IF NOT EXISTS volume_total      integer,
  ADD COLUMN IF NOT EXISTS volume_is_lt10    boolean,
  ADD COLUMN IF NOT EXISTS volume_comp_idx   text,
  ADD COLUMN IF NOT EXISTS volume_checked_at timestamptz,
  -- 첫 회차(9/16) 사후 추가. 「못 쟀다」를 «값으로» 남기는 자리다.
  ADD COLUMN IF NOT EXISTS volume_invalid    text;

COMMENT ON COLUMN keyword_rank_targets.volume_invalid IS
  '검색량 조회 부적격/정규화 원장. NULL 이면 정상. 값이 있으면 그 사유로 조회가 거부됐거나 '
  '정규화해서 물었다는 뜻이다. 이 열이 채워진 행에는 volume_checked_at 을 찍지 않는다 — '
  '찍으면 「쟀는데 0」이라는 거짓 신선도가 된다.';

COMMENT ON COLUMN keyword_rank_targets.volume_total IS
  'RelKwdStat 월간 검색수 pc+mobile. NULL = 미측정(0 이 아니다). sa.py volume 이 적재한다.';
COMMENT ON COLUMN keyword_rank_targets.volume_is_lt10 IS
  'API 가 「< 10」을 돌려준 축이 하나라도 있으면 true. 그때 수치는 0 으로 적재한다 — '
  '실값은 1~9 구간이며, 「검색량 없음」 판정은 0 이 아니라 이 깃발로 한다.';
COMMENT ON COLUMN keyword_rank_targets.volume_checked_at IS
  '마지막 측정 시각. NULL 이면 한 번도 안 쟀다 — 거짓 신선도를 막는 자.';

CREATE INDEX IF NOT EXISTS idx_krt_volume_checked
  ON keyword_rank_targets (volume_checked_at NULLS FIRST);

-- ─────────────────────────────────────────────────────────────
-- 2. IN-1 — 현장별 유입 실측 뷰
--    게이트: 활성 현장 «전행» 커버. 방문이 0 인 현장도 행으로 남는다
--            (무방문율이 이 뷰의 산출물이므로, 빠지면 분모가 사라진다).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_in1_site_traffic AS
WITH pv AS (
  SELECT
    url_decode(substring(path from '^/apt/([^/?#]+)')) AS slug,
    bot_type,
    referrer,
    created_at
  FROM page_views
  -- 상세만. 허브(/apt/region/…, /apt/unsold …)는 세그먼트가 둘이라 이 정규식에 안 걸린다.
  WHERE path ~ '^/apt/[^/?#]+$'
), agg AS (
  SELECT
    slug,
    count(*) FILTER (WHERE bot_type = 'human' AND created_at >= now() - interval '7 days')  AS pv_7d,
    count(*) FILTER (WHERE bot_type = 'human' AND created_at >= now() - interval '30 days') AS pv_30d,
    count(*) FILTER (WHERE bot_type = 'human')                                              AS pv_all,
    count(*) FILTER (WHERE bot_type = 'human' AND referrer ILIKE '%naver%'
                       AND created_at >= now() - interval '7 days')                         AS naver_7d,
    count(*) FILTER (WHERE bot_type = 'human' AND referrer ILIKE '%naver%'
                       AND created_at >= now() - interval '30 days')                        AS naver_30d,
    count(*) FILTER (WHERE bot_type = 'human' AND referrer ILIKE '%google%'
                       AND created_at >= now() - interval '30 days')                        AS google_30d,
    -- 봇 방문은 「색인은 되는데 사람이 안 온다」와 「봇도 안 온다」를 가른다. IN-2 의 갈래다.
    count(*) FILTER (WHERE bot_type IS DISTINCT FROM 'human'
                       AND created_at >= now() - interval '30 days')                        AS bot_30d,
    max(created_at) FILTER (WHERE bot_type = 'human')                                       AS last_human_at
  FROM pv
  GROUP BY slug
), vol AS (
  -- 이름 정합은 «공백 제거 + 소문자» 한 겹만 쓴다. 광고 쪽(sa.py)이 키워드를 만들 때와 같은 규칙이다.
  -- ⚠️ 지금 적재 커버리지는 표적 수십 종뿐이라 대부분 행은 NULL 로 나간다. 그게 정상이다.
  SELECT
    lower(replace(keyword, ' ', ''))                     AS norm_kw,
    max(volume_total)                                    AS volume_total,
    bool_or(coalesce(volume_is_lt10, false))             AS volume_is_lt10,
    max(volume_checked_at)                               AS volume_checked_at
  FROM keyword_rank_targets
  WHERE volume_checked_at IS NOT NULL
  GROUP BY 1
)
SELECT
  s.slug,
  s.name,
  s.display_name,
  s.region,
  s.sigungu,
  s.lifecycle_stage,
  s.site_type,
  s.supply_type,
  s.total_units,
  s.content_score,
  s.ad_blocked,

  coalesce(a.pv_7d, 0)      AS pv_7d,
  coalesce(a.pv_30d, 0)     AS pv_30d,
  coalesce(a.pv_all, 0)     AS pv_all,
  coalesce(a.naver_7d, 0)   AS naver_7d,
  coalesce(a.naver_30d, 0)  AS naver_30d,
  coalesce(a.google_30d, 0) AS google_30d,
  coalesce(a.bot_30d, 0)    AS bot_30d,
  a.last_human_at,

  -- 검색량 축. measured 가 false 면 volume_total 은 «모른다» 이지 «0» 이 아니다.
  (v.volume_checked_at IS NOT NULL) AS volume_measured,
  v.volume_total,
  v.volume_is_lt10,
  v.volume_checked_at,

  -- 판정 보조 (경계 자체는 IN-2 에서 세션 A 교차 후 확정한다. 여기서 Tier 를 박지 않는다.)
  (coalesce(a.pv_30d, 0) = 0)                                   AS no_visit_30d,
  (coalesce(a.pv_all, 0) = 0)                                   AS no_visit_ever,
  (coalesce(a.naver_30d, 0) > 0)                                AS naver_live,
  (coalesce(a.pv_all, 0) = 0 AND coalesce(a.bot_30d, 0) = 0)    AS untouched
FROM apt_sites s
LEFT JOIN agg a ON a.slug = s.slug
LEFT JOIN vol v ON v.norm_kw = lower(replace(s.name, ' ', ''))
WHERE s.is_active;

COMMENT ON VIEW v_in1_site_traffic IS
  'IN-1 — 현장별 주간/월간 방문·네이버 유입·검색량. IN-2 Tier 판정의 단일 재료. '
  '활성 현장 전행 커버(무방문 행 포함). naver_live=true 행은 ④ 441 하한 게이트의 모집단이며 '
  'noindex 후보에서 «절대» 빠져야 한다.';
