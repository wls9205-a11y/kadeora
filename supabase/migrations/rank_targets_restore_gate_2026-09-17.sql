-- 순위 수집 표적 — ① 복구 → ② 게이트 → ③ 강등 (세션 A 판정 2026-09-17, 한 트랜잭션)
--
-- ⛔ 순서가 뒤집히면 안 된다. ①을 건너뛴 ②는 승부처를 수집에서 영구 소멸시킨다.
--    active=false 570행은 «처분» 이 아니라 «검수 안 함» 이었다 — 2026-08-25 부울경 파이프라인
--    자동 시드가 자기 출력을 일괄 active=false 로 넣고 아무도 손대지 않았다.
--    그 안에 승부처 3현장 본명(해링턴 마레 13,100 · 연제 갤러리 자이 4,880 · 엄궁역 트라비스 하늘채 3,030)이 있었다.
--
-- 원장 표기
--   · 35,140 = 비활성 중 수요>0 «41행» 총수요 (승부처 직격 6행분 아님 — 그쪽은 약 2.3만)
--   · 소멸 위험 범위 = 비활성 전체(570). 6행은 그중 직격분.
--   · 체제 전환일 회전 주기: 27.6일 → 9.3일 (P2 102행 / 슬롯 11). 산출은 본문 끝 주석.
--
-- 적용 전 실측 (2026-09-17)
--   P1 active 63 · P2 active 67 · P2 inactive 403(수요 26, 승부처 3) · P3 inactive 167(수요 15, 승부처 3)

BEGIN;

-- ① 복구 — 승부처 6행: P1 승격 (본명 3 + 분양가 3)
UPDATE keyword_rank_targets
SET priority = 1, active = true
WHERE id IN (575, 386, 428, 497, 160, 306) AND tracked;

-- ① 복구 — 나머지 수요>0 비활성: P2 + active (P2측 23 + P3 비승부처 분양가 롱테일 12)
--    12행은 게이트 「현장 연계 키워드는 P3 강등 금지」 문리 그대로 — 승격도 강등도 아닌 제자리.
UPDATE keyword_rank_targets
SET priority = 2, active = true
WHERE tracked AND NOT active AND coalesce(volume_total, 0) > 0
  AND priority IN (2, 3);

-- ③ 강등 — P3 잔여(수요 0) → 후보군
UPDATE keyword_rank_targets
SET tracked = false, priority = 9
WHERE tracked AND priority = 3 AND NOT active AND coalesce(volume_total, 0) = 0;

-- ② 게이트
CREATE OR REPLACE FUNCTION public.get_rank_targets_due(p_limit integer DEFAULT 60)
 RETURNS TABLE(keyword text, priority integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- ⚠️ active 는 «검수 통과» 다. 비활성 복귀 트리거는 없다 — 비활성으로 내리는 건 곧 수집 중단이다.
  select t.keyword, t.priority
  from keyword_rank_targets t
  where t.tracked and t.active
  order by
    t.priority,
    t.last_checked_at nulls first,
    t.keyword
  limit greatest(least(coalesce(p_limit, 60), 80), 1);
$function$;

-- 긍정형 확인 — 수가 하나라도 어긋나면 전체 롤백
DO $$
DECLARE p1 int; p2 int; p3 int; due_inactive int; battle int;
BEGIN
  SELECT count(*) INTO p1 FROM keyword_rank_targets WHERE tracked AND active AND priority = 1;
  SELECT count(*) INTO p2 FROM keyword_rank_targets WHERE tracked AND active AND priority = 2;
  SELECT count(*) INTO p3 FROM keyword_rank_targets WHERE tracked AND priority = 3;
  SELECT count(*) INTO battle FROM keyword_rank_targets
    WHERE id IN (575, 386, 428, 497, 160, 306) AND tracked AND active AND priority = 1;
  SELECT count(*) INTO due_inactive FROM keyword_rank_targets
    WHERE tracked AND NOT active AND coalesce(volume_total, 0) > 0;
  IF p1 <> 69 OR p2 <> 102 OR p3 <> 0 OR battle <> 6 OR due_inactive <> 0 THEN
    RAISE EXCEPTION 'rank_targets 복구 수 불일치: p1=% p2=% p3=% battle=% inactive_demand=%',
      p1, p2, p3, battle, due_inactive;
  END IF;
END $$;

COMMIT;

-- 회전 주기 산출: 일일 상한 80 − P1 69 = P2 슬롯 11 → 102 / 11 = 9.3일
--   (판정문의 105·9.5 는 P2측 복구 26 에 P1 으로 올라간 승부처 본명 3 을 이중 계상한 값)
-- 비활성 P2 수요 0 377행은 tracked 로 남되 게이트로 수집 제외 — 처분은 별건.
