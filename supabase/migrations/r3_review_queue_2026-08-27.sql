-- R3 — 검수 큐 3건 (2026-08-27)
--
-- T1-2 에서 「이름 변형이 아니다」라고 판정해 검수 큐로 넘긴 것들이다.

-- ── ① 군산 등 후행 공백 12행 ────────────────────────────────────────────────
-- house_nm 에 붙은 공백 하나 때문에 이름 조인이 통째로 빗나갔다.
-- ⚠️ 조인부(btrim)는 이미 고쳤지만, 원본이 지저분하면 다른 곳에서 또 걸린다.
update apt_subscriptions set house_nm = btrim(house_nm) where house_nm <> btrim(house_nm);
-- 실측: 12행 → 0. 최근 90일 이름 조인 미매칭 3 → 2.

-- ── ② 신제주 시그니처원Ⅱ 의 변형이 «전부 Ⅰ» 이었다 ─────────────────────────
-- Ⅰ 과 Ⅱ 는 «다른 현장» 이다(연동 274-12 / 182세대 ↔ 274-25 / 196세대).
-- Ⅱ 행이 Ⅰ 문자열을 변형으로 갖고 있어, Ⅰ 에 대한 글·거래가 Ⅱ 에 붙을 수 있었다.
-- ⚠️ 지우기만 하면 변형이 0개가 된다. 로마숫자만 «Ⅰ→Ⅱ» 로 고쳐 올바른 변형을 남긴다 —
--    생성 규칙은 맞았고 숫자만 틀렸다.
update apt_sites
   set name_variants = (
     select jsonb_agg(distinct replace(v, 'Ⅰ', 'Ⅱ'))
       from jsonb_array_elements_text(name_variants) v
   )
 where name = '신제주 동문디이스트 시그니처원Ⅱ'
   and name_variants::text like '%Ⅰ%';

-- ── ③ 호반써밋 풍무Ⅲ — «누락된 현장» 이라 신규 행 ───────────────────────────
-- B4블록 660세대. 형제(Ⅱ = C5블록 961세대, B5블록 = 956세대)는 이미 있는데 Ⅲ만 없었다.
-- ⚠️ content_score 는 «채우지 않는다». crawl 이 돌면서 자연 산정된다 —
--    손으로 넣으면 그 값이 어디서 왔는지 아무도 모르게 된다.
-- ⚠️ stage_source 를 null 로 둔다. stage-derive 크론이 청약 날짜로 «유도» 한다.
insert into apt_sites (slug, name, region, sigungu, dong, site_type, total_units,
                       address, status, is_active, source_ids)
select '호반써밋-풍무-3', '호반써밋 풍무Ⅲ', '경기', '김포시', '사우동', 'subscription', 660,
       '김포 풍무역세권 B4블록 (경기도 김포시 사우동 458번지 일원)', 'active', true,
       jsonb_build_object('house_manage_no', '2026000329', 'created_by', 'R3-3 manual')
 where not exists (select 1 from apt_sites where name = '호반써밋 풍무Ⅲ');
