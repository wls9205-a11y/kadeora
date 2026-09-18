-- BN-B 첫 배치 8 + C3 1 — issue_alerts 글감 적재 (BN §5 · 2026-09-18)
--
-- 경로: issue_alerts → issue-draft → safeBlogInsert. 새 크론 0 · 새 생성기 0 (BP-B 레일 복제).
-- 판독 hold: source_type 'bn_hub' → app_config bn.hub_publish_enabled(false) 동안 비공개 초안 +
--   auto_unpublished_reason 'hold:bn_review' 도장(d801620d). BN-B 통과 후 세션 A 가 스위치 true + 사유 비움.
-- 선정: §5-5 1순위 중 단지명 T-B 확정분 7(사직2·사직4·사직5·부곡2·범천4·괴정5·수영1)
--   + 감천2(T-B · preempt 111426 hold 대체). T-C 명칭(광안5·사직3·사직1-5)·명칭 근거 없음(서금사5·6)은 2차.
--   C3: 촉진3(아크로 라로체) 동승 — BP70 카운트 산입, 판독은 BN 스위치로. 우동3(아센테르)은 builder 정정 후.
-- 글감 규격:
--   issue_type 'redevelopment' → apt_redev 템플릿(선점형 청약전략 섹션 없음 — 조합 단계 현장)
--   apt_site_id 지정 → hub 고정(8곳 모두 리드 가능 단계)
--   raw_data.complex_name/zone_label → 현장 블록 병기 지시(25523b4e) · title_spec → 제목 규격(§5-3)
--   source_urls 비움 — 출처 원문의 세대수가 DB 와 어긋나는 곳이 있어(괴정5 3,102 vs 3,509 · 촉진3 3,554 vs 3,545)
--     수치 허용 목록을 DB 블록 하나로 둔다. 명칭 근거는 complex_name_src(문자열, 추출 안 함).
--   final_score 45 — BP-B 와 같은 자리.
-- 가격: 9곳 price_source 전건 NULL → 현장 블록이 「분양가 미공개」로 안내(§5-4).
-- 재실행 안전: 같은 현장에 source_type 'bn_hub' 글감이 있으면 넣지 않는다.

with t(slug, cn, zone, src, c3) as (values
  ('사직2-재개발', '래미안 사직 엘라티오', '사직2구역 재개발', '머니투데이 2024-08-25 (삼성물산 수주)', false),
  ('사직4-재개발', '푸르지오 그라니엘', '사직4구역 재개발', '이투데이 2026-01-19 · 부산일보 2026-01-20 (대우건설 선정)', false),
  ('사직5-재개발', '힐스테이트 사직 더프리즘', '사직5구역 재개발', '시사오늘 (현대건설 선정)', false),
  ('부곡2-재개발', '자이 더 센터니티', '부곡2구역 재개발', '국토일보 2022-06 (GS건설 선정)', false),
  ('범천4-재개발', '힐스테이트 르네센트', '범천4구역 재개발', '부산일보 2021-08-17 · 현대건설 보도자료', false),
  ('괴정5-시범생활권-재개발', '힐스테이트 푸르지오 사하역 포레스트', '괴정5구역 재개발', '부산일보 2024-09-10 (현대건설·대우건설 컨소시엄 수주)', false),
  ('수영1-재개발', '센텀자이 리버노블', '수영1구역 재개발', '부산일보 2025-01-20 · 아시아경제 2026-09-10 (GS건설)', false),
  ('감천2-재개발', '힐스테이트 오션스카이', '감천2구역 재개발', '안전신문 2023-11-21 (현대건설)', false),
  ('시민공원주변재정비촉진3구역-재개발', '아크로 라로체', '시민공원 촉진3구역 재개발', '뉴시스 2022-11-07 · 한국경제 2022-10-12 (DL이앤씨 단독)', true)
),
pick as (
  select s.id, s.slug, s.region, s.sigungu, t.cn, t.zone, t.src, t.c3
  from t join apt_sites s on s.slug = t.slug and s.is_active
  where not exists (select 1 from issue_alerts i where i.apt_site_id = s.id and i.source_type = 'bn_hub')
)
insert into issue_alerts (title, summary, category, sub_category, issue_type, source_type, source_urls,
                          detected_keywords, apt_site_id, region_sido, region_sigungu, base_score, final_score, raw_data)
select p.cn || ' — ' || p.zone || ' 현재 상황·일정 총정리',
       p.cn || '(시공사 제안 단지명) — ' || p.region || ' ' || p.sigungu || ' ' || p.zone || ' 사업 단계·일정 정리 (BN 허브 발행)',
       'apt', 'bn_hub', 'redevelopment', 'bn_hub', '{}'::text[],
       array[p.cn, p.zone, p.cn || ' 분양', replace(p.zone, ' 재개발', '') || ' 재개발'],
       p.id, p.region, p.sigungu, 45, 45,
       jsonb_build_object('batch', case when p.c3 then 'BN-B-1/C3' else 'BN-B-1' end, 'slug', p.slug,
         'complex_name', p.cn, 'zone_label', p.zone, 'complex_name_src', p.src,
         'bp70_count', p.c3,
         'title_spec', '「' || p.cn || ' — ' || p.zone || ' 현재 상황·일정 총정리」 형식, 30~45자. 연도·월 숫자를 넣지 않는다. 하이픈 절단 금지')
from pick p
returning id, title, apt_site_id;
