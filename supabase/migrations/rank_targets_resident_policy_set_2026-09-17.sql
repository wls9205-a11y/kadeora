-- 상주층 자격 재정의 — 이력이 아니라 정책 (세션 A 판정 2026-09-17)
--
-- 앞 마이그레이션(rank_targets_p1_layers)의 상주 6행은 「9/17 복구 때 비활성이던 승부처 행」이었다.
-- 그건 복구 «이력» 이지 정책이 아니다. 이력 기준이면 건강했던 현장이 벌을 받는다 —
-- 거제는 이미 P1 이라 복구 대상이 아니었고, 그래서 NV5-auto TTL 층에 남아
-- 분양가(686)가 오늘 밤 강등돼 4현장 비교 격자에 구멍이 날 뻔했다.
--
-- 정의: 상주 = 승부처 정책 집합 = src/lib/apt/e10-targets.ts 4현장 × {본명, 분양가} = 8행
--   해링턴 마레 575·160 · 연제 갤러리 자이 386·497 · 엄궁역 트라비스 하늘채 428·306 · 힐스테이트 거제시그니처 685·686
-- 편입 밖: 687·688(거제 청약·입주)은 TTL 대상 유지. 700 「트라비스 하늘채」(TC-방어 별칭)는 정책 집합 밖.
--
-- 시한: fn_nv5_rank_target_lifecycle cron 은 GMT 22:50(= KST 07:50). 적용 시각 03:38 UTC.

BEGIN;

UPDATE keyword_rank_targets SET resident = true WHERE id IN (685, 686);

COMMENT ON CONSTRAINT keyword_rank_targets_resident_is_p1 ON keyword_rank_targets IS
  '상주층은 반드시 tracked ∧ P1. 자격은 이력이 아니라 정책 — 승부처 정책 집합(e10-targets 4현장 × 본명·분양가). 상주층의 유일한 편출 경로는 승부처 지정 해제이지 TTL 이 아니다 (2026-09-17 세션 A 판정)';

COMMENT ON COLUMN keyword_rank_targets.resident IS
  '상주층 — 승부처 정책 집합(e10-targets 4현장 × 본명·분양가). P1 상한·수명 강등·TTL 의 통치 밖. 편출은 승부처 지정 해제로만 (2026-09-17)';

DO $$
DECLARE res int; exact int; bad int; ttl_due int;
BEGIN
  SELECT count(*) INTO res FROM keyword_rank_targets WHERE resident;
  SELECT count(*) INTO exact FROM keyword_rank_targets
    WHERE resident AND id IN (575, 160, 386, 497, 428, 306, 685, 686);
  SELECT count(*) INTO bad FROM keyword_rank_targets WHERE resident AND NOT (tracked AND active AND priority = 1);
  -- 오늘 밤 TTL «첫 진입» 강등 예정 행 — 상주 편입으로 0 이어야 한다
  SELECT count(*) INTO ttl_due FROM keyword_rank_targets t
    WHERE t.tracked AND t.priority = 1 AND NOT t.resident AND t.note LIKE 'NV5-auto%'
      AND (EXISTS (SELECT 1 FROM keyword_rank_daily d
                    WHERE d.keyword = t.keyword AND d.rank IS NOT NULL AND d.date >= t.created_at::date)
           OR t.created_at < now() - interval '14 days');
  IF res <> 8 OR exact <> 8 OR bad <> 0 OR ttl_due <> 0 THEN
    RAISE EXCEPTION '상주 정책 집합 불일치: resident=% exact=% bad=% ttl_due=%', res, exact, bad, ttl_due;
  END IF;
END $$;

COMMIT;
