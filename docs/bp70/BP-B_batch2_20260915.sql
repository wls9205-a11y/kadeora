-- BP-B 두 번째 발행 배치 20 — issue_alerts 글감 적재 (ABG 증분 2 §1 · 2026-09-15)
--
-- 경로·규격은 1회차(BP-B_batch1_20260915.sql)와 같다: issue_alerts → issue-draft(생성/편집 회차 · 수치 게이트) → safeBlogInsert.
-- 순서(판정회신 ABG 증분 2 §1): ① T1 임박(esp 2026Q3~2026-12) → ② 신규 초선점(2026-09-14 이후 생성 · BP70 문서 카드 시드 12 + TC 디에트르)
--   → ③ TC 대조 기존재(발행 무): 쌍용 더 플래티넘 서면 · 더샵 트리센트 · e편한세상 센텀 하이베뉴 · 반여4(센텀 리버루체).
--   (TC 8 중 구산 롯데캐슬·에코델타 엘가 로제비앙·창원자이 더 스카이·두산위브 트리니뷰 구명역·동래 푸르지오 에듀포레는 hub 발행 기존재라 제외)
-- 제외: 연산15-재개발(redev 동기화 신설 · 단계 null — BP70 대상 아님) · 판문 2BL(1회차와 같은 사유 — 588세대 근거 weak).
-- 실측 후보 19(20 미달) — T1 1(범천동 주상복합) · 신규 14 · TC 기존재 4.
-- 제목 꼬리: esp 있음 → 「분양일정」 / 시공 단계(분양 끝) → 「입주 예정」 / 그 외 → 「분양 정보」 — 끝난 분양에 「분양일정」을 붙이지 않는다.
-- 재실행 안전: 같은 현장에 bp70_hub·cvn_name_event 글감이 있거나 hub 발행글이 있으면 넣지 않는다. 같은 현장 동시 생성은 issue-draft same_site_pending 이 막는다.

with pick as (
  select s.id, s.slug, s.region, s.sigungu,
         coalesce(nullif(split_part(s.display_name, ' — ', 1), ''), s.name) as nm,
         s.expected_sale_period as esp, s.lifecycle_stage,
         case
           when s.expected_sale_period in ('2026Q3','2026-09','2026-10','2026-11','2026-12') then 1
           when s.created_at >= '2026-09-14' then 2
           else 3
         end as tier,
         s.expected_sale_sort
  from apt_sites s
  where s.is_active and s.region in ('부산','울산','경남')
    and s.lifecycle_stage is not null
    and s.slug <> '판문도시개발사업지구-2bl-공동주택'
    and (s.expected_sale_period in ('2026Q3','2026-09','2026-10','2026-11','2026-12')
         or (s.created_at >= '2026-09-14' and s.slug <> '연산15-재개발')
         or s.slug in ('쌍용-더-플래티넘-서면','더샵-트리센트','e편한세상-센텀-하이베뉴','반여4-재건축'))
    and not exists (select 1 from blog_posts b where b.is_published and b.hub_apt_slug = s.slug)
    and not exists (select 1 from issue_alerts i where i.apt_site_id = s.id and i.source_type in ('bp70_hub','cvn_name_event'))
  order by tier, s.expected_sale_sort nulls last, s.slug
  limit 20
)
insert into issue_alerts (title, summary, category, sub_category, issue_type, source_type, source_urls,
                          detected_keywords, apt_site_id, region_sido, region_sigungu, base_score, final_score, raw_data)
select (case when p.nm like p.region || '%' then p.nm
             -- 「김해 부원동 …」처럼 이름이 시군구로 시작하면 시군구를 또 붙이지 않는다(「경남 김해시 김해 …」 방지)
             when p.nm like regexp_replace(split_part(coalesce(p.sigungu, ''), ' ', 1), '(시|군|구)$', '') || ' %' and coalesce(p.sigungu, '') <> '' then p.region || ' ' || p.nm
             else trim(concat_ws(' ', p.region, p.sigungu, p.nm)) end)
         || case when p.esp is not null and p.esp not like '2027%' then ' 분양일정'
                 when p.lifecycle_stage in ('construction','contract_signing','move_in_ready') then ' 입주 예정'
                 else ' 분양 정보' end,
       p.nm || coalesce(' — 분양예정 ' || p.esp, '') || ' (BP70 현장 허브 발행 2회차)',
       'apt', 'bp_hub', 'pre_announcement', 'bp70_hub', '{}'::text[],
       array[p.nm, p.nm || ' 분양일정', p.nm || ' 분양가'],
       p.id, p.region, p.sigungu, 45, 45,
       jsonb_build_object('batch', 'BP-B-2', 'tier', p.tier, 'esp', p.esp, 'slug', p.slug)
from pick p
returning title, raw_data->>'tier' tier;
