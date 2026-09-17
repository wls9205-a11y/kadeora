-- 순위 수집 표적 — ⑴ P2 무수요 377행 후보군 강등 + CHECK (NOT tracked OR active) (세션 A 판정 2026-09-17, 한 트랜잭션)
--
-- ── 0db671f9 (rank_targets_restore_gate_2026-09-17.sql) 머리말 정정 ──
--   그 머리말의 「8/25 부울경 자동 시드가 자기 출력을 일괄 active=false 로 넣고 아무도 손대지 않았다」는 «틀렸다».
--   실측(supabase_migrations.schema_migrations):
--     20260825034817 keyword_rank_targets_rotation_and_seed — 시드는 active=«true» 로 넣었다.
--     20260825034854 keyword_targets_split_legacy_gate     — 37초 뒤 tracked 열을 만들어 회전 게이트를 넘기고,
--                                                             active 를 «옛 게이트» 로 격하하며 시드분을 일괄 false 로 돌렸다.
--   지뢰의 기폭은 8/25 가 아니라 9/17 — 격하된 열을 옛 의미(게이트)로 되살리자는 제안·승인이었다.
--   반복 생산자는 없다(일회성 마이그레이션 · cron/함수 INSERT 0). 적용된 머리말은 이력 존치 규율로 고치지 않는다.
--
-- ── 이 제약의 뜻 ──
--   이제 「쉼」은 tracked=false(후보군)뿐이다. tracked=true ∧ active=false 라는 반쪽 상태는 존재하지 않는다.
--   게이트(get_rank_targets_due: tracked AND active)가 영구 스킵하는 «등재됐지만 안 재는» 행을 쓰기 시점에 막는다.
--
-- 적용 전 실측 (2026-09-17): tracked∧¬active 377행 = 전부 P2 · 수요 0 · 8/25 시드분. 그 외 위반 0.
--   쓰기 주체 정합: 열 기본값 tracked=true·active=true / NV5 registerRankTargets 둘 다 true / sa.py cmd_seed 둘 다 false.

BEGIN;

-- ⑴ 강등 — 152행(P3 수요 0)과 같은 계급이므로 같은 처분
UPDATE keyword_rank_targets
SET tracked = false, priority = 9
WHERE tracked AND NOT active AND coalesce(volume_total, 0) = 0;

ALTER TABLE keyword_rank_targets
  ADD CONSTRAINT keyword_rank_targets_tracked_requires_active CHECK (NOT tracked OR active);

COMMENT ON CONSTRAINT keyword_rank_targets_tracked_requires_active ON keyword_rank_targets IS
  '쉼은 tracked=false(후보군)뿐 — tracked∧¬active 반쪽 상태는 존재하지 않는다. 게이트가 영구 스킵하는 등재 행을 쓰기 시점에 차단 (2026-09-17 세션 A 판정)';

-- 긍정형 확인 — 수가 하나라도 어긋나면 전체 롤백
DO $$
DECLARE half int; p1 int; p2 int; cand int;
BEGIN
  SELECT count(*) INTO half FROM keyword_rank_targets WHERE tracked AND NOT active;
  SELECT count(*) INTO p1   FROM keyword_rank_targets WHERE tracked AND active AND priority = 1;
  SELECT count(*) INTO p2   FROM keyword_rank_targets WHERE tracked AND active AND priority = 2;
  SELECT count(*) INTO cand FROM keyword_rank_targets WHERE NOT tracked AND priority = 9;
  IF half <> 0 OR p1 <> 69 OR p2 <> 102 OR cand <> 3381 THEN
    RAISE EXCEPTION 'rank_targets ⑴ 수 불일치: tracked∧¬active=% p1=% p2=% candidates=%', half, p1, p2, cand;
  END IF;
END $$;

COMMIT;
