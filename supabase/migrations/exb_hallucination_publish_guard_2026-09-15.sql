-- EX-B — 환각 처분(hide) 글의 재공개 차단 가드.
--
-- 실측(2026-09-15 03:45Z): 처분 hide 167 중 50편을 blog-auto-publish 가 다시 공개했다.
--   처분 UPDATE 가 is_published 만 내리고 auto_publish_eligible(과거에 서 있던 플래그)을 남겨 둔 탓.
--   is_published=true 를 쓰는 경로는 크론만 60여 개라 경로별 차단은 새는 곳이 남는다 → 행 단위 가드 하나로 막는다.
-- 규약: auto_unpublished_reason 이 'hallucination%' 인 행은 어떤 UPDATE 로도 공개로 넘어가지 않는다(조용히 비공개 유지).
--   ⚠️ 사람이 복원하려면 사유를 먼저 비운다(같은 UPDATE 에서 비워도 된다 — NEW 기준 판정).
--   ⚠️ auto_unpublished_at 은 채우지 않는다 — blog_restore_pace() 가 그 열을 복원 후보 조건으로 쓴다.

create or replace function public.guard_hallucination_republish()
returns trigger language plpgsql as $$
begin
  if new.is_published and not coalesce(old.is_published, false)
     and coalesce(new.auto_unpublished_reason, '') like 'hallucination%' then
    new.is_published := false;
    new.auto_publish_eligible := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_hallucination_republish on public.blog_posts;
create trigger trg_guard_hallucination_republish
  before update of is_published on public.blog_posts
  for each row execute function public.guard_hallucination_republish();
