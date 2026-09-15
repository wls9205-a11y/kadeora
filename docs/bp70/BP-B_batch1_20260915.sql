-- BP-B 첫 발행 배치 20 — issue_alerts 글감 적재 (PQAB E-5 · 2026-09-15)
--
-- 경로: issue_alerts → issue-draft(LB-4 정렬) → safeBlogInsert. 새 크론 0 · 새 생성기 0.
-- 선정: 부울경 활성 · BP70 대상(esp 보유 또는 doc:BP70 시드) · hub 연결 발행 0편 · 리드폼 서는 단계 ·
--       esp 가 임박 구간(2026Q3 · 2026-09 ~ 2026-12) — T1. expected_sale_sort 오름차순.
--       제외: 판문 2BL(588세대 근거가 지역 고시·애그리게이터뿐 — BP70 조사 D-2 weak).
-- 글감 규격:
--   title  「{시·도 시군구} {현장명} 분양일정」 — LB-4 PRESALE_HINT 로 P2, 현장명은 display 「 — 」 앞
--   issue_type 'pre_announcement' → issue-draft 선점형 분량(6,000~8,000자)·규칙
--   apt_site_id 지정 → 제목 재매칭 없이 그 현장, hub_apt_slug 도 그 현장(44d2426f)
--   final_score 45 — CV-N 이벤트와 같은 자리(문턱 25·발행 임계 35 위, 사람이 만든 고득점 아래)
-- 재실행 안전: 같은 현장에 source_type 'bp70_hub' 글감이 이미 있으면 넣지 않는다.

with pick as (
  select s.id, s.slug, s.region, s.sigungu,
         coalesce(nullif(split_part(s.display_name, ' — ', 1), ''), s.name) as nm,
         s.expected_sale_period as esp, s.expected_sale_sort
  from apt_sites s
  where s.is_active and s.region in ('부산','울산','경남')
    and s.expected_sale_period in ('2026Q3','2026-09','2026-10','2026-11','2026-12')
    and s.slug <> '판문도시개발사업지구-2bl-공동주택'
    and s.lifecycle_stage in ('site_planning','pre_announcement','subscription_open','award_pending','award_announced','unsold_active','move_in_ready','move_in_started','union_established','constructor_selected','plan_approved','mgmt_approved','construction','contract_signing')
    and not exists (select 1 from blog_posts b where b.is_published and b.hub_apt_slug = s.slug)
    and not exists (select 1 from issue_alerts i where i.apt_site_id = s.id and i.source_type = 'bp70_hub')
  order by s.expected_sale_sort, s.slug
  limit 20
)
insert into issue_alerts (title, summary, category, sub_category, issue_type, source_type, source_urls,
                          detected_keywords, apt_site_id, region_sido, region_sigungu, base_score, final_score, raw_data)
-- ⚠️ display_name 이 「부산 서구 …」처럼 지명을 이미 품는다 — 앞에 또 붙이면 「부산 서구 부산 서구 …」(1회차 실측, 적재 직후 UPDATE 로 정정)
select (case when p.nm like p.region || '%' then p.nm else trim(concat_ws(' ', p.region, p.sigungu, p.nm)) end) || ' 분양일정',
       p.nm || ' — 분양예정 ' || p.esp || ' (BP70 현장 허브 발행)',
       'apt', 'bp_hub', 'pre_announcement', 'bp70_hub', '{}'::text[],
       array[p.nm, p.nm || ' 분양일정', p.nm || ' 분양가'],
       p.id, p.region, p.sigungu, 45, 45,
       jsonb_build_object('batch', 'BP-B-1', 'esp', p.esp, 'slug', p.slug)
from pick p
returning id, title, apt_site_id;
