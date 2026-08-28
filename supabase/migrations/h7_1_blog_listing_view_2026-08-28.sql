-- H7-1 — /blog 지역 선택이 «0건» 이던 원인 (2026-08-28)
--
-- ── 무엇이 일어났나 ─────────────────────────────────────────────────────────
-- A5 가 blog_posts 에 apt_site_id·mentioned_site_ids 를, H5-3 이 apt_region·apt_sigungu 를
-- 추가했다. 그런데 목록이 읽는 `v_blog_posts_listing` 은 «컬럼을 하나씩 나열하는» 뷰라
-- 새 컬럼이 들어오지 않았다. 화면 코드는 그걸 모르고 이렇게 건다:
--
--     q2.eq('apt_region', region)      ← 뷰에 없는 컬럼
--
-- PostgREST 는 400 을 내고, 조회 래퍼는 그것을 «빈 배열» 로 돌려준다.
-- 그래서 「글이 없는 것」과 「쿼리가 깨진 것」이 화면에서 똑같이 보였다.
-- 실제로는 부산 301편 · 서울 592 · 경기 491 … 17개 시도가 다 채워져 있다.
--
-- ⚠️⚠️ 이 고장은 «조용하다». 500 도 아니고 로그도 안 남는다. 그래서 하루 뒤에야
--      사람이 화면을 보고 알았다. 같은 침묵을 다시 만들지 않으려면 아래 규칙을 지킬 것.
--
-- ⛔ 규칙 — blog_posts 에 컬럼을 추가하는 마이그레이션은 «같은 파일에서» 이 뷰를 재정의한다.
--    뷰를 나중에 고치겠다고 미루면, 그 사이 화면은 조용히 0건을 낸다.
--
-- ⚠️ `b.*` 로 쓴 것은 의도다. Postgres 가 «생성 시점에» 펼치므로 자동 추적은 안 되지만,
--    적어도 이 파일을 다시 돌리는 것만으로 그 시점의 전 컬럼이 들어온다 —
--    64개를 손으로 옮겨 적다 하나 빠뜨리는 쪽보다 안전하다.
--    ⛔ blog_posts 에 `sub_norm`·`group_key` 라는 이름의 컬럼을 만들지 말 것(아래와 충돌).

drop view if exists public.v_blog_posts_listing;

create view public.v_blog_posts_listing
with (security_invoker = on) as
select
  b.*,
  fn_blog_subcat_norm(b.category, b.sub_category) as sub_norm,
  fn_blog_group(b.category)                       as group_key
from blog_posts b;

-- ── 권한 ────────────────────────────────────────────────────────────────────
-- ⚠️ 이전 뷰는 anon 에게 INSERT·UPDATE·DELETE 까지 열려 있었다. 코드상 이 뷰로
--    쓰는 곳은 «한 군데도 없고»(전수 확인), blog_posts 는 RLS 가 켜져 있어 실제 피해는
--    없었지만 열어 둘 이유가 없다. 읽기만 준다.
-- ⚠️ security_invoker = on 을 «반드시» 유지한다. 끄면 뷰가 소유자 권한으로 돌아
--    비공개 글(is_published=false)이 anon 에게 새어 나간다.
grant select on public.v_blog_posts_listing to anon, authenticated;
grant all    on public.v_blog_posts_listing to service_role;
