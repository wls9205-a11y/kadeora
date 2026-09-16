-- K-10 ① — 봇 대면 응답 계기 (2026-09-16) · 적용분 기록
--
-- 수신구는 «Supabase Edge Function» 이다: supabase/functions/bot-hits-drain
--   URL https://tezftxakuwhsclarprlz.supabase.co/functions/v1/bot-hits-drain
--
-- ⛔ 왜 Vercel 라우트가 아닌가 — 이번 사고의 핵심 교훈이다.
--    수신구를 «관측 대상 시스템 안» 에 두면 배달 요청 자체가 로그를 낳고, 그 로그가 다시
--    배달되어 자기증폭한다. 실측 ~144회/분까지 가속했다.
--    적재를 막아도(코드의 continue) «배달» 은 계속 일어나므로 코드로는 못 끊는다 —
--    「계기가 스스로를 관측하면 안 된다」는 코드 규칙이 아니라 «배치의 성질» 이다.
--
-- 이 계기가 없던 동안 무엇을 못 봤나: page_views 는 클라이언트 JS 비콘이라
--   30일간 Googlebot 0 · Yeti 0 이었다. 그건 「안 온다」가 아니라 «계기 범위 밖» 이었다.
--   점등 3분 만에 Yeti 19 · Googlebot 3 이 잡혔다.

CREATE TABLE IF NOT EXISTS bot_hits (
  id           bigserial PRIMARY KEY,
  occurred_at  timestamptz NOT NULL,
  bot          text        NOT NULL,   -- classifyBot 결과(yeti/googlebot/bingbot/naver/daum/other)
  status       smallint,               -- 프록시가 실제로 «돌려준» 상태코드
  path         text,
  host         text,
  region       text,
  cache        text,                   -- proxy.vercelCache (HIT/MISS)
  source       text,                   -- 드레인 소스(edge/lambda/static…)
  path_type    text,
  ua           text,
  request_id   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_hits_time     ON bot_hits (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_hits_bot_time ON bot_hits (bot, occurred_at DESC);
-- 이 표의 존재 이유가 이 질의다.
CREATE INDEX IF NOT EXISTS idx_bot_hits_5xx      ON bot_hits (occurred_at DESC) WHERE status >= 500;

-- ⚠️ «부분» 유니크로 두면 안 된다. ON CONFLICT 가 부분 인덱스를 추론하지 못해 upsert 가
--    통째로 실패하고, 한 배치의 중복 한 건이 나머지 전부를 날린다(오늘 두 번 본 형태).
--    Postgres 는 유니크에서 NULL 을 서로 다른 값으로 보므로 부분 조건이 애초에 불필요하다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_hits_request ON bot_hits (request_id);

DROP VIEW IF EXISTS v_bot_hits_daily;
CREATE VIEW v_bot_hits_daily AS
SELECT
  (occurred_at AT TIME ZONE 'Asia/Seoul')::date       AS day_kst,
  bot,
  count(*)                                             AS hits,
  count(*) FILTER (WHERE status BETWEEN 200 AND 399)   AS ok,
  count(*) FILTER (WHERE status BETWEEN 400 AND 499)   AS c4xx,
  count(*) FILTER (WHERE status >= 500)                AS c5xx,
  round(100.0 * count(*) FILTER (WHERE status >= 500) / nullif(count(*), 0), 2) AS pct_5xx,
  -- 분모 구성. Static 편입 전후를 이 세 칸으로 가른다 —
  -- cache_hit 가 늘면 캐시 정상 응답이 들어오기 시작했다는 뜻이고 그때부터 pct_5xx 가 진짜다.
  count(*) FILTER (WHERE cache = 'HIT')                AS cache_hit,
  count(*) FILTER (WHERE cache = 'MISS')               AS cache_miss,
  count(*) FILTER (WHERE cache IS NULL)                AS cache_unknown,
  count(DISTINCT path)                                 AS distinct_paths
FROM bot_hits
GROUP BY 1, 2;

CREATE OR REPLACE VIEW v_bot_5xx_paths AS
SELECT
  (occurred_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,
  bot, status, path,
  count(*) AS hits,
  max(occurred_at) AS last_at
FROM bot_hits
WHERE status >= 500
GROUP BY 1, 2, 3, 4;
