-- upcoming_projects 폐기 — «읽기전용 보존» (2026-08-29 · Node 승인)
--
-- ── 왜 drop 이 아닌가 ───────────────────────────────────────────────────────
-- 이 표는 4월 수동 시드가 부패한 «증거» 다(R-4 의 근거 둘 중 하나). 지우면
-- 「왜 수동 시드를 금지했는가」의 물증이 사라진다. 32행을 그대로 둔 채
-- «더 이상 자라지 못하게» 만 한다.
--
-- ⛔ drop 금지. truncate 금지.
-- ⚠️ 쓰기를 막는 것이 목적이므로 service_role 의 쓰기도 «같이» 뗀다. 앱 통로에서
--    이 표에 다시 행이 붙을 길을 남겨 두면, 금지는 사람 기억에 기대는 규칙이 되고
--    그런 규칙은 반복해서 실패한다(Rule #115 가 세 번 실패한 이유와 같다).
--    정말 고쳐야 하면 «마이그레이션» 으로 한다 — 그때는 기록이 남는다.
--
-- ── 기록자 전수 (Rule #115) ────────────────────────────────────────────────
--   코드 기록자 1곳뿐: cron/blog-upcoming-projects 가 blog_post_id·updated_at 갱신.
--     그 라우트는 세션 138 부터 이미 early-return 이라 «실제로는 안 쓴다».
--     이번 커밋에서 vercel.json 크론 등록도 뗐다(79 → 78).
--   pg_cron: upcoming 을 건드리는 잡 0건.
--   RLS: 이미 켜져 있고 정책 2개(public SELECT · service_role ALL).
--     ⚠️ anon·authenticated 에 INSERT/UPDATE/DELETE «grant» 는 열려 있었으나
--        정책이 SELECT 만 허용해 실제로 쓰이지 못했다. 실피해 없음.
--        그래도 grant 를 남겨 둘 이유가 없어 같이 뗀다.

revoke insert, update, delete, truncate, references, trigger
  on upcoming_projects from anon, authenticated, service_role;

-- 읽기는 남긴다 — 증거로서 조회할 수 있어야 한다.
grant select on upcoming_projects to anon, authenticated, service_role;

comment on table upcoming_projects is
  '⛔ 폐기(2026-08-29). 읽기전용 보존 — 4월 수동 시드 부패의 물증이라 drop 하지 않는다. '
  '쓰기 grant 를 뗐으므로 앱 통로로는 갱신되지 않는다. 분양예정 현장의 단일 진실은 apt_sites(D1).';
