-- R4 — 「N명 활동 중」에서 크롤러를 뺀다 (2026-08-27)
--
-- ── 실측 ────────────────────────────────────────────────────────────────────
-- page_views 30일: human 3,839 · other 3,297 · bingbot 931 · daum 12
--   → «봇이 4,240 으로 사람(3,839)보다 많다». 헤더의 「N명 활동 중」이 절반 이상 크롤러다.
--
-- ⚠️ 지시서는 「봇 UA 를 visitor_id 없이 기록」이었는데, visitor_id 는 NOT NULL 이고
--    적재부(api/analytics/pageview)는 «이미» classifyBot(ua) 로 bot_type 을 채우고 있다.
--    UA 보유율도 100% 다. 즉 소급도 필요 없다 — 빠진 것은 «세는 쪽» 이었다.
--    행을 지우거나 컬럼을 바꾸지 않는다. 봇 트래픽도 SEO 관측에 쓰이는 자료다.
--
-- ⛔ 'other' 는 사람이 아니다. classifyBot 에서 bot|crawler|spider|slurp|… 패턴에
--    걸린 것들이다. 「분류 실패」가 아니라 「일반 봇」이다.

create or replace function public.get_active_visitors(minutes integer default 30)
returns integer
language sql stable
set search_path to 'public', 'pg_temp'
as $fn$
  SELECT COUNT(DISTINCT visitor_id)::int
  FROM page_views
  WHERE created_at > now() - (minutes || ' minutes')::interval
    -- ⚠️ bot_type 이 null 인 옛 행은 «사람으로 보지 않는다». 판정된 적이 없는 값이라
    --    사람이라고 주장할 근거가 없다. 「모르는 것」을 「사람」으로 세면 그게 곧 부풀림이다.
    AND bot_type = 'human';
$fn$;
