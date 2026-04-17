-- ============================================================
-- 20260417_calc_results.sql — 계산기 결과 영구 URL
-- "내 청약 가점 64점" 카카오톡 공유 → 친구 클릭 → 영구 URL → SEO 백링크
-- ============================================================

CREATE TABLE IF NOT EXISTS public.calc_results (
  short_id TEXT PRIMARY KEY,                    -- nanoid 8자리
  calc_slug TEXT NOT NULL,
  calc_category TEXT NOT NULL,
  inputs JSONB NOT NULL,
  result JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  referer_domain TEXT,
  user_agent_brief TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

ALTER TABLE public.calc_results ENABLE ROW LEVEL SECURITY;

-- 누구나 short_id 알면 조회 가능 (SEO 목적)
DROP POLICY IF EXISTS "calc_results_read" ON public.calc_results;
CREATE POLICY "calc_results_read" ON public.calc_results
  FOR SELECT USING (true);

-- 비로그인/로그인 모두 결과 저장 가능
DROP POLICY IF EXISTS "calc_results_insert" ON public.calc_results;
CREATE POLICY "calc_results_insert" ON public.calc_results
  FOR INSERT WITH CHECK (true);

-- 본인 결과만 수정/삭제
DROP POLICY IF EXISTS "calc_results_update_own" ON public.calc_results;
CREATE POLICY "calc_results_update_own" ON public.calc_results
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "calc_results_delete_own" ON public.calc_results;
CREATE POLICY "calc_results_delete_own" ON public.calc_results
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_calc_results_expires
  ON public.calc_results(expires_at);

CREATE INDEX IF NOT EXISTS idx_calc_results_popular
  ON public.calc_results(calc_slug, view_count DESC)
  WHERE expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_calc_results_user
  ON public.calc_results(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ── view_count 증가 RPC (race-safe) ──
CREATE OR REPLACE FUNCTION public.increment_calc_result_view(p_short_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.calc_results
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE short_id = p_short_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_calc_result_view FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_calc_result_view TO service_role, anon, authenticated;

-- ── share_count 증가 RPC ──
CREATE OR REPLACE FUNCTION public.increment_calc_result_share(p_short_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.calc_results
  SET share_count = COALESCE(share_count, 0) + 1
  WHERE short_id = p_short_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_calc_result_share FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_calc_result_share TO service_role, anon, authenticated;

-- ── 만료 결과 정리 함수 (크론에서 일 1회 호출) ──
CREATE OR REPLACE FUNCTION public.cleanup_expired_calc_results()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.calc_results
  WHERE expires_at < NOW()
    AND view_count < 5;  -- 인기 결과는 보관 연장
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_calc_results FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_calc_results TO service_role;

COMMENT ON TABLE public.calc_results IS 'Permanent URL for calculator results. SEO + viral sharing weapon.';
