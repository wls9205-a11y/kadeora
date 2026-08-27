-- H5-3 — 블로그 지역 필터를 «태그» 에서 «엔티티» 로 (2026-08-27)
--
-- ── 왜 바꾸나 ───────────────────────────────────────────────────────────────
-- 지금까지 /blog 의 지역 세그먼트는 `tags` 배열에 지역명이 들어 있는지로 걸렀다.
-- blog_posts 에 지역 컬럼이 없었기 때문이다. 그 결과 3개 지역(부산 379 · 울산 84 ·
-- 경남 189)만 걸 수 있었다.
--
-- A5 가 apt_site_id 를 붙이면서 사정이 달라졌다. 엔티티 기준으로 세면 «17개 시도 전부»
-- 에 글이 있다:
--   서울 592 · 경기 491 · 부산 301 · 경남 244 · 전남 219 · 경북 216 · 충남 184
--   울산 119 · 충북 113 · 대전 111 · 인천 108 · 대구 71 · 광주 42 · 강원 42
--   전북 37 · 제주 37 · 세종 11        (발행 8,705 중 링크 2,938)
--
-- ── 왜 조인이 아니라 컬럼인가 ───────────────────────────────────────────────
-- PostgREST 임베드 조인(`apt_sites!inner(region)`)으로도 되지만, 목록 쿼리는 이 페이지의
-- «본체» 라 검증 없이 바꿀 수 없다. 로컬 키가 만료라 REST 로 확인할 방법이 없었다.
-- 파생 컬럼이면 SQL 로 «지금 여기서» 검증된다. 지시서도 컬럼 추가는 허용한다.
--
-- ⚠️ 이 두 컬럼은 «파생값» 이다. 손으로 채우지 말 것 — apt_site_id 가 정본이다.
--    트리거가 apt_site_id 변경 시 자동으로 맞춘다.

alter table blog_posts add column if not exists apt_region   text;
alter table blog_posts add column if not exists apt_sigungu  text;

create index if not exists idx_blog_posts_apt_region
  on blog_posts (apt_region, published_at desc)
  where is_published and apt_region is not null;

-- ── 백필 ──
update blog_posts b
   set apt_region = s.region, apt_sigungu = s.sigungu
  from apt_sites s
 where s.id = b.apt_site_id
   and (b.apt_region is distinct from s.region or b.apt_sigungu is distinct from s.sigungu);

-- ── 동기화 트리거 ──
-- ⚠️ issue-draft 관문이 apt_site_id 를 쓰고 지나간다. 그때 지역이 안 따라오면
--    새 글이 지역 필터에서 통째로 빠진다 — 「안 보이는데 이유를 모르는」 종류의 고장이다.
create or replace function public.fn_blog_sync_apt_region()
returns trigger language plpgsql as $fn$
begin
  if new.apt_site_id is null then
    new.apt_region := null;
    new.apt_sigungu := null;
  else
    select s.region, s.sigungu into new.apt_region, new.apt_sigungu
      from apt_sites s where s.id = new.apt_site_id;
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_blog_sync_apt_region on blog_posts;
create trigger trg_blog_sync_apt_region
  before insert or update of apt_site_id on blog_posts
  for each row execute function public.fn_blog_sync_apt_region();

-- ── 구군 칩 건수 ──
-- ⚠️ 배지는 «글 수» 가 아니라 «현장 수» 다. 글 수로 세면 한 현장에 16편이 붙은 구가
--    실제 현장은 1곳인데 가장 커 보인다(실측: 알티에로 광안 16편).
create or replace function public.get_blog_sigungu_counts(p_region text)
returns table(sigungu text, site_count bigint)
language sql stable security invoker as $fn$
  select b.apt_sigungu, count(distinct b.apt_site_id)
    from blog_posts b
   where b.is_published
     and b.apt_region = p_region
     and b.apt_sigungu is not null
   group by b.apt_sigungu
   order by b.apt_sigungu
$fn$;

grant execute on function public.get_blog_sigungu_counts(text) to anon, authenticated;
