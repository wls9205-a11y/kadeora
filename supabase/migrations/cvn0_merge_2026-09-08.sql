-- CV-N ⓪ N-0 선행 정리 (2026-09-08)
--
-- ⛔ 여기에 «비활성 + 308» 은 들어 있지 않다. Node 지시로 착지 교체 11키워드를
--    308 활성화보다 «먼저» 둔다 — 그래야 광고 키워드가 리다이렉트를 경유하는 창이 0이다.
--    구 레코드는 이 마이그레이션 뒤에도 살아 있고, 체인 4(착지 교체) 직후 별도로 내린다.
--
-- ⚠️ 쓰기 순서는 전부 «트리거 컬럼 먼저, 별칭 마지막» 이다(v1.2-B).
--    trg_apt_sites_auto_variants = BEFORE INSERT OR UPDATE OF name, sigungu, dong, builder,
--    본문은 COALESCE(jsonb_array_length(NEW.name_variants),0) < 3 이면 통째 교체.
--    → 별칭«만» 쓰는 UPDATE 는 트리거를 깨우지 않는다(실측). sigungu 를 쓰는 UPDATE 는 깨운다.

-- (apply_migration 이 전체를 한 트랜잭션으로 감싼다 — 여기서 BEGIN 을 다시 열지 않는다)

-- ══ ① 라로체 3각 ═══════════════════════════════════════════════════════════
-- 실물(2026-09-08):
--   정본  69c148ec 시민공원주변재정비촉진3구역 재개발 · 범전동 · 디엘이엔씨 · 3,545
--         → 이미 「아크로 라로체」·「아크로라로체」·「촉진3구역」 보유
--   오류  e2bb27ca slug=아크로-라로체 · 부암동 · DL이앤씨 · lifecycle=construction
--         → 별칭이 ["촉진1구역","시민공원 촉진1구역","라로체"]
--   진짜 촉진1 f411b641 시민공원주변재정비촉진1구역 재개발 · 부암동 · GS건설 · 1,874
--
-- 3각의 심장은 e2bb27ca 다 — «이름은 촉진3(라로체)을 가리키고 별칭은 촉진1을 가리킨다».
-- dong=부암동도 촉진1의 것이다(촉진3은 범전동). 그래서 이 레코드의 별칭은 어느 쪽으로도
-- 승계할 수 없다. 촉진1 별칭은 «진짜 촉진1» 로 보내고, 라로체는 정본이 이미 갖고 있다.
--
-- ⛔ 촉진1 오표기 별칭을 촉진3(정본)으로 승계하지 않는다. 그것이 3각을 재생산한 경로다.

-- (1-a) 촉진1 별칭을 «진짜» 촉진1 로 — 이 레코드는 짧은형 「촉진1구역」이 없었다.
INSERT INTO public.site_name_applies (site_id, op, before_value, after_value, run_id)
SELECT id, 'alias_add', name_variants,
       name_variants || '["촉진1구역","시민공원 촉진1구역"]'::jsonb, 'cvn-n0-2026-09-08'
FROM public.apt_sites WHERE id = 'f411b641-cd3e-45f6-a7e1-76353bdabb31';

UPDATE public.apt_sites
   SET name_variants = name_variants || '["촉진1구역","시민공원 촉진1구역"]'::jsonb
 WHERE id = 'f411b641-cd3e-45f6-a7e1-76353bdabb31'
   AND NOT (name_variants @> '["촉진1구역"]'::jsonb);

-- (1-b) 정본 촉진3 에 「라로체」 단독형 보강 (「아크로 라로체」는 이미 있다)
INSERT INTO public.site_name_applies (site_id, op, before_value, after_value, run_id)
SELECT id, 'alias_add', name_variants, name_variants || '["라로체"]'::jsonb, 'cvn-n0-2026-09-08'
FROM public.apt_sites WHERE id = '69c148ec-7a30-46b4-a7d6-3104c1e8053d';

UPDATE public.apt_sites
   SET name_variants = name_variants || '["라로체"]'::jsonb
 WHERE id = '69c148ec-7a30-46b4-a7d6-3104c1e8053d'
   AND NOT (name_variants @> '["라로체"]'::jsonb);

-- (1-c) 오표기 레코드의 별칭을 비운다. 별칭만 쓰므로 트리거는 깨지 않는다.
--       레코드 자체는 «살려 둔다» — 광고 착지가 아직 여기를 가리키고 있다(체인 4에서 내린다).
INSERT INTO public.site_name_applies (site_id, op, before_value, after_value, run_id)
SELECT id, 'alias_add', name_variants, '[]'::jsonb, 'cvn-n0-2026-09-08'
FROM public.apt_sites WHERE id = 'e2bb27ca-6cdb-4806-8ba7-ec685356b347';

UPDATE public.apt_sites SET name_variants = '[]'::jsonb
 WHERE id = 'e2bb27ca-6cdb-4806-8ba7-ec685356b347';

-- ══ ② 우동1 이중 ═══════════════════════════════════════════════════════════
--   정본 5b03bbd1 우동1 재건축 · DL이앤씨 · 1,476
--   중복 4eacd0f6 slug=부산-우동1-재건축 · builder NULL · 별칭 ["부산","재건축",…] 조각
INSERT INTO public.site_name_applies (site_id, op, before_value, after_value, run_id)
SELECT id, 'alias_add', name_variants, '[]'::jsonb, 'cvn-n0-2026-09-08'
FROM public.apt_sites WHERE id = '4eacd0f6-0af7-455f-8bba-8d2af2f73e8c';

UPDATE public.apt_sites SET name_variants = '[]'::jsonb
 WHERE id = '4eacd0f6-0af7-455f-8bba-8d2af2f73e8c';

-- ══ ③ 「해운대 아크로」 유일성 소급 판정 ════════════════════════════════════
-- 5b03bbd1(우동1 · 1,476)과 f99ee93d(반여3 · 915)가 «둘 다» 갖고 있고 둘 다 DL·해운대다.
-- 어느 쪽도 유일하게 가리키지 못하므로 광고로 나가면 절반이 틀린다.
-- ⛔ 대체 별칭을 지어내지 않는다(가칭 배제). 확정 예정명이 오면 CV-N 이 그때 넣는다.
INSERT INTO public.site_name_applies (site_id, op, before_value, after_value, run_id)
SELECT id, 'alias_add', name_variants,
       (SELECT jsonb_agg(v) FROM jsonb_array_elements(name_variants) v WHERE v <> '"해운대 아크로"'::jsonb),
       'cvn-n0-2026-09-08'
FROM public.apt_sites
WHERE id IN ('5b03bbd1-774e-427d-a843-a7d808c99554','f99ee93d-2b5a-46fd-adba-0c1736cf5449');

UPDATE public.apt_sites SET name_variants = COALESCE(
         (SELECT jsonb_agg(v) FROM jsonb_array_elements(name_variants) v WHERE v <> '"해운대 아크로"'::jsonb),
         '[]'::jsonb)
 WHERE id IN ('5b03bbd1-774e-427d-a843-a7d808c99554','f99ee93d-2b5a-46fd-adba-0c1736cf5449');

-- ══ ④ sigungu 이형 정규화 ═════════════════════════════════════════════════
-- 「창원시」(50+행)가 정본이고 「창원시 성산구」·「창원시 의창구」가 각 1행이다.
-- ⚠️ sigungu 는 트리거 감시 컬럼이다. 두 행의 별칭은 4·3 개로 둘 다 「3 미만」이 아니라
--    통째 교체를 비켜간다 — 518a9490 은 «정확히 3» 으로 한 칸 차이다. 그래서 순서를 지킨다.
UPDATE public.apt_sites SET sigungu = '창원시'
 WHERE id IN ('770f49e1-ccec-4b3b-8b78-25b7a5cb4178','518a9490-2e04-4c7d-9be3-56ae4559c616');

-- 별칭 마지막 — 770f49e1 은 별칭 셋이 「창원시 성산구/성산」 이형을 그대로 품고 있었다.
INSERT INTO public.site_name_applies (site_id, op, before_value, after_value, run_id)
SELECT id, 'alias_add', name_variants,
       '["용지호반써밋더퍼스트","창원 용지호반써밋더퍼스트","창원시 용지호반써밋더퍼스트"]'::jsonb,
       'cvn-n0-2026-09-08'
FROM public.apt_sites WHERE id = '770f49e1-ccec-4b3b-8b78-25b7a5cb4178';

UPDATE public.apt_sites
   SET name_variants = '["용지호반써밋더퍼스트","창원 용지호반써밋더퍼스트","창원시 용지호반써밋더퍼스트"]'::jsonb
 WHERE id = '770f49e1-ccec-4b3b-8b78-25b7a5cb4178';
