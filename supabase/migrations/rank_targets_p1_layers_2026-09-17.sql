-- 순위 표적 P1 — 3층 판정 (세션 A 2026-09-17): ② 승부처 상주층(cap 밖) · ③ name-watch 체류층 TTL
--
-- 왜: 복구로 P1 이 69 가 되어 상한 70(P1_CAP)까지 1칸 — NV-5 ④ 예정명 자동 등재가 사실상 막혔다.
--   (a) 승부처를 cap 에서 빼기 · (b) cap 올리기는 «같은 거래의 두 표기» — 둘 다 일일 80 안에서 P2 회전을
--   잠식하고 자기 청소가 없다. TTL 없는 (a)로 상한이 실차면 P1 76 · P2 4슬롯 · 회전 25.5일(어제 죽인 기아의 재현).
--
-- ② 상주층 — resident=true. 정책으로 박은 고정핀이라 cap 의 통치 대상이 아니다.
--    lifecycle 의 수명 강등·상한 강등 모두에서 제외, P1 상한 계산(rank-targets.ts)에서도 제외.
--    CHECK: 상주층은 반드시 tracked ∧ P1. 내리려면 resident 부터 명시적으로 푼다.
-- ③ 체류층 — note 'NV5-auto%'(cvn-name-watch 유입분)만. 두 조건 중 먼저 오는 것으로 P2:
--    · 첫 진입 감지(rank 가 한 번이라도 잡힘) — 리드타임 계측 완료 = 목적 달성
--    · 등재 후 14일 무진입 — 리드타임 계측은 진입 창에만 일일 정밀이 필요하지 영주권이 필요한 게 아니다
--    ⚠️ 기존 ② 상한 강등의 「아직 진입 못한 표적은 건드리지 않는다」는 NV5-auto 에 한해 TTL 이 우선한다.
--    ⚠️ 기준 시각은 등재(created_at) = 이름 감지 시점. NV5-seed·TRIVN 등 수동 시드는 이 TTL 밖(별건).
--
-- 선결 실측(일일 80 의 근거, 2026-09-17): 80 은 get_rank_targets_due 의 «자체 캡» 이지 API 쿼터가 아니다.
--   429 이력(8/25·8/31~9/3)은 버스트 레이트 문제였고 CHUNK_DELAY 600ms 도입 후 9/4~9/16 13일 연속 err_429=0.
--   실행 27.5초 / TIME_BUDGET 95초. 단 NAVER_CLIENT_ID 를 쓰는 라우트가 10곳 이상이고 라우트별 콜 원장이 없어
--   일일 쿼터 «사용률» 은 1발로 못 쟀다 — 그래서 캡은 여기서 올리지 않는다.

BEGIN;

ALTER TABLE keyword_rank_targets ADD COLUMN IF NOT EXISTS resident boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN keyword_rank_targets.resident IS
  '상주층 — 정책으로 박은 고정핀(승부처). P1 상한·수명 강등의 통치 밖. 내리려면 이 값부터 푼다 (2026-09-17)';

UPDATE keyword_rank_targets SET resident = true WHERE id IN (575, 386, 428, 497, 160, 306);

ALTER TABLE keyword_rank_targets
  ADD CONSTRAINT keyword_rank_targets_resident_is_p1 CHECK (NOT resident OR (tracked AND priority = 1));

CREATE OR REPLACE FUNCTION public.fn_nv5_rank_target_lifecycle(p_cap integer DEFAULT 70)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_p1        int;
  v_ttl_hit   int := 0;
  v_ttl_stale int := 0;
  v_aged      int := 0;
  v_overflow  int := 0;
BEGIN
  -- ⓪ 체류층 TTL — cvn-name-watch 유입분(NV5-auto)만. 상주층(resident)은 절대 건드리지 않는다.
  --    첫 진입 감지 = 리드타임 계측 완료 → P2
  UPDATE keyword_rank_targets t
     SET priority = 2,
         note = coalesce(t.note,'') || ' | NV5 TTL: 첫 진입 감지(리드타임 계측 완료)'
   WHERE t.tracked AND t.priority = 1 AND NOT t.resident
     AND t.note LIKE 'NV5-auto%'
     AND EXISTS (SELECT 1 FROM keyword_rank_daily d
                  WHERE d.keyword = t.keyword AND d.rank IS NOT NULL AND d.date >= t.created_at::date);
  GET DIAGNOSTICS v_ttl_hit = ROW_COUNT;

  --    등재 후 14일 무진입 → P2
  UPDATE keyword_rank_targets t
     SET priority = 2,
         note = coalesce(t.note,'') || ' | NV5 TTL: 등재 14일 무진입'
   WHERE t.tracked AND t.priority = 1 AND NOT t.resident
     AND t.note LIKE 'NV5-auto%'
     AND t.created_at < now() - interval '14 days';
  GET DIAGNOSTICS v_ttl_stale = ROW_COUNT;

  -- ① 수명 — 첫 진입 후 30일이 지났고 최근 14일 순위가 «안정» 하면 P2 로 내린다.
  --    안정 = 관측이 5회 이상이고 최고·최저 순위 차가 5 이내.
  WITH stat AS (
    SELECT t.id,
           min(d.date) FILTER (WHERE d.rank IS NOT NULL) AS first_rank_date,
           count(*)    FILTER (WHERE d.rank IS NOT NULL AND d.date > CURRENT_DATE - 14) AS obs14,
           max(d.rank) FILTER (WHERE d.date > CURRENT_DATE - 14) AS worst14,
           min(d.rank) FILTER (WHERE d.date > CURRENT_DATE - 14) AS best14
    FROM keyword_rank_targets t
    JOIN keyword_rank_daily d ON d.keyword = t.keyword
    WHERE t.tracked AND t.priority = 1 AND NOT t.resident
    GROUP BY t.id
  )
  UPDATE keyword_rank_targets t
     SET priority = 2,
         note = coalesce(t.note,'') || ' | NV5 강등: 진입 30일+ 순위 안정'
    FROM stat s
   WHERE t.id = s.id
     AND s.first_rank_date IS NOT NULL
     AND s.first_rank_date < CURRENT_DATE - 30
     AND s.obs14 >= 5
     AND coalesce(s.worst14 - s.best14, 99) <= 5;
  GET DIAGNOSTICS v_aged = ROW_COUNT;

  -- ② 총량 — 상주층을 뺀 P1 이 상한을 넘으면 «오래되고 이미 진입한» 것부터 내린다.
  --    ⚠️ 아직 한 번도 진입하지 못한 표적은 «건드리지 않는다» — 그건 아직 답이 안 나온
  --       질문이고, 내리면 영영 답을 못 듣는다. (NV5-auto 는 ⓪ TTL 이 따로 청소한다.)
  SELECT count(*) INTO v_p1 FROM keyword_rank_targets WHERE tracked AND priority = 1 AND NOT resident;
  IF v_p1 > p_cap THEN
    WITH ranked AS (
      SELECT t.id,
             (SELECT min(d.date) FROM keyword_rank_daily d
               WHERE d.keyword = t.keyword AND d.rank IS NOT NULL) AS first_rank_date,
             t.created_at
      FROM keyword_rank_targets t
      WHERE t.tracked AND t.priority = 1 AND NOT t.resident
    ), demote AS (
      SELECT id FROM ranked
      WHERE first_rank_date IS NOT NULL
      ORDER BY created_at ASC
      LIMIT GREATEST(v_p1 - p_cap, 0)
    )
    UPDATE keyword_rank_targets t
       SET priority = 2,
           note = coalesce(t.note,'') || ' | NV5 강등: P1 상한 초과'
      FROM demote d WHERE t.id = d.id;
    GET DIAGNOSTICS v_overflow = ROW_COUNT;
  END IF;

  SELECT count(*) INTO v_p1 FROM keyword_rank_targets WHERE tracked AND priority = 1 AND NOT resident;
  RETURN jsonb_build_object(
    'p1_after', v_p1, 'cap', p_cap,
    'resident', (SELECT count(*) FROM keyword_rank_targets WHERE resident),
    'demoted_ttl_entered', v_ttl_hit, 'demoted_ttl_stale', v_ttl_stale,
    'demoted_aged', v_aged, 'demoted_overflow', v_overflow);
END;
$function$;

-- 긍정형 확인
DO $$
DECLARE res int; res_bad int; p1_nonres int; p2 int;
BEGIN
  SELECT count(*) INTO res FROM keyword_rank_targets WHERE resident;
  SELECT count(*) INTO res_bad FROM keyword_rank_targets WHERE resident AND NOT (tracked AND active AND priority = 1);
  SELECT count(*) INTO p1_nonres FROM keyword_rank_targets WHERE tracked AND priority = 1 AND NOT resident;
  SELECT count(*) INTO p2 FROM keyword_rank_targets WHERE tracked AND active AND priority = 2;
  IF res <> 6 OR res_bad <> 0 OR p1_nonres <> 63 OR p2 <> 102 THEN
    RAISE EXCEPTION 'P1 3층 수 불일치: resident=% resident_bad=% p1_nonresident=% p2=%', res, res_bad, p1_nonres, p2;
  END IF;
END $$;

COMMIT;

-- ── 부속 (별도 적용: nv5_lifecycle_revoke_public_2026_09_17) ──
-- 실측: fn_nv5_rank_target_lifecycle 은 SECURITY DEFINER 로 표를 UPDATE 하는데 EXECUTE 가
--   PUBLIC·anon·authenticated 에 열려 있었다(PostgREST /rpc 로 누구나 호출 가능). 형제 함수
--   get_rank_targets_due·mark_rank_targets_checked 는 service_role 한정. 호출자는 pg_cron(postgres) 뿐이라 정합화.
REVOKE ALL ON FUNCTION public.fn_nv5_rank_target_lifecycle(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_nv5_rank_target_lifecycle(integer) TO service_role;
