-- H7-3 — 집계 행 격리 + 외부 핫링크 커버 제거 (2026-08-28)
--
-- ══ ① 집계 행 ══════════════════════════════════════════════════════════════
-- 홈 「지금 계약 가능」에 「부산 기장군 미분양 385세대」가 «현장처럼» 떠 있었다.
-- 그건 현장이 아니라 «구군 집계 한 줄» 이다. 누르면 갈 곳도 없고 세대수도 합계다.
--
-- ⚠️ site_type='unsold' 전부가 집계는 «아니다». 실측 215건 중
--      170건 = 「{시도} {시군구} 미분양」  ← 집계 행 (전부 is_active=true)
--       45건 = 「창원 의창 푸르지오」·「인천 서구 루원시티 SK뷰」 …
--              세대수 380~852 · content_score 79~95 «실제 현장»
--    site_type 만 보고 걸렀다면 멀쩡한 현장 45곳을 화면에서 지웠을 것이다.
-- ⚠️ 집계 행에도 total_units 가 «있을 수 있다» — 그건 합계다.
--    실측 3건: 부산 기장군 385 · 충북 진천군 1,010 · 경기 광주시 1,077.
--    「세대수가 있으니 현장이겠지」로 가르면 틀린다. 이름 판정이 맞다.
--
-- ⛔ 이름 패턴에 «계속 기대지 않는다». 지금 한 번 판정해 컬럼으로 굳히고,
--    앞으로 조회는 그 컬럼만 본다. 패턴은 데이터가 바뀌면 조용히 어긋난다.

alter table apt_sites add column if not exists is_aggregate boolean not null default false;

update apt_sites
   set is_aggregate = true
 where site_type = 'unsold'
   and name like '%미분양'
   and is_aggregate is not true;

comment on column apt_sites.is_aggregate is
  '집계 한 줄(구군 미분양 롤업 등). 현장이 아니다. '
  '⛔ 화면 조회는 activeSiteFilter() 를 거쳐 이 컬럼을 «반드시» 제외한다 — '
  '홈·목록·타일 RPC·검색·관측·다른 현장·sitemap 전부.';

-- 목록 조회가 늘 이 컬럼을 걸므로 부분 인덱스로 받는다.
create index if not exists idx_apt_sites_not_aggregate
  on apt_sites (region, sigungu)
  where is_aggregate = false and is_active is not false;

-- ══ ② 외부 핫링크 커버 ══════════════════════════════════════════════════════
-- 실측(활성 6,033곳): hero 실사 174 · 우리 OG 카드 cover 1,689 · «외부» cover 3,008.
-- 외부 호스트 상위: imgnews.naver.net 1,254 · t1.daumcdn.net 781 · blog.kakaocdn.net 534
--                  www.neonet.co.kr 29 · file.kcrwork.com 26 · postfiles.pstatic.net 24 …
--
-- 언론사·개인 블로그 사진을 핫링크하고 있었다. R1 에서 «블로그 본문» 의 같은 문제를
-- 걷어냈는데 «현장 커버» 는 남아 있었다. 실제로 깨져 보이고(스모크가 shop1.phinf 를 잡았다)
-- 인증서 불일치까지 난다.
--
-- ⚠️ 되돌릴 수 있게 통째로 떠 둔다. ⛔ 복원은 금지지만 «근거» 는 남긴다.
-- ⚠️ hero_image_url 은 «외부가 0건» 이라(실측) 건드리지 않는다. 1순위는 안전하다.

create table if not exists apt_cover_backup_h7 (
  site_id         uuid primary key references apt_sites(id) on delete cascade,
  cover_image_url text not null,
  host            text,
  backed_up_at    timestamptz not null default now()
);

insert into apt_cover_backup_h7 (site_id, cover_image_url, host)
select id, cover_image_url, substring(cover_image_url from '^https?://([^/]+)')
  from apt_sites
 where cover_image_url is not null
   and cover_image_url not like 'https://kadeora.app/%'
   and cover_image_url not like '%supabase%'
on conflict (site_id) do nothing;

update apt_sites
   set cover_image_url = null
 where cover_image_url is not null
   and cover_image_url not like 'https://kadeora.app/%'
   and cover_image_url not like '%supabase%';
