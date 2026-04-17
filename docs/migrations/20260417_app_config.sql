-- ============================================================
-- 20260417_app_config.sql — 통합 운영 설정 테이블
-- 모든 한도/배치/모델/스위치를 DB에서 관리 (무하드코딩)
-- 적용: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (namespace, key)
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_service_only" ON public.app_config;
CREATE POLICY "app_config_service_only" ON public.app_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "app_config_admin_read" ON public.app_config;
CREATE POLICY "app_config_admin_read" ON public.app_config
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS idx_app_config_ns ON public.app_config(namespace);

-- ── 초기 시드 ──
INSERT INTO public.app_config (namespace, key, value, description) VALUES
  ('naver_cafe', 'enabled', 'true'::jsonb, '네이버 카페 자동 발행 ON/OFF'),
  ('naver_cafe', 'batch_size', '1'::jsonb, '회차당 발행 건수'),
  ('naver_cafe', 'sleep_between_ms', '2000'::jsonb, '발행 간 대기 시간 (ms)'),
  ('naver_cafe', 'daily_limit', '8'::jsonb, '일일 발행 한도'),
  ('naver_blog_content', 'enabled', 'true'::jsonb, '블로그→카페 변환 콘텐츠 생성 ON/OFF'),
  ('naver_blog_content', 'batch_size', '3'::jsonb, '회차당 생성 건수'),
  ('calc_seo', 'auto_share_url', 'true'::jsonb, '계산기 결과 공유 URL 활성화'),
  ('calc_seo', 'result_retention_days', '90'::jsonb, '계산기 결과 보관 일수'),
  ('calc_seo', 'sitemap_top_results_limit', '1000'::jsonb, '사이트맵 인기 결과 노출 수'),
  ('calc_seo', 'topic_refresh_days', '30'::jsonb, '토픽 허브 AI 갱신 주기 (일)'),
  ('calc_seo', 'min_view_count_for_sitemap', '5'::jsonb, '사이트맵 노출 최소 조회수'),
  ('ai_models', 'default_haiku', '"claude-haiku-4-5-20251001"'::jsonb, '기본 Haiku 모델'),
  ('ai_models', 'default_sonnet', '"claude-sonnet-4-6"'::jsonb, '기본 Sonnet 모델 (4.6)'),
  ('ai_models', 'default_opus', '"claude-opus-4-7"'::jsonb, '기본 Opus 모델 (4.7)'),
  ('ai_models', 'use_prompt_cache', 'true'::jsonb, 'Prompt 캐싱 사용 여부'),
  ('ai_models', 'use_batch_api', 'true'::jsonb, 'Batch API 사용 여부 (50% 할인)'),
  ('master_kill', 'all_crons_paused', 'false'::jsonb, '🚨 모든 크론 즉시 정지 (마스터 킬 스위치)'),
  ('master_kill', 'all_publishing_paused', 'false'::jsonb, '🚨 모든 외부 발행 정지 (네이버/카카오/이메일/푸시)')
ON CONFLICT (namespace, key) DO NOTHING;

-- ── 일괄 토글 헬퍼 ──
CREATE OR REPLACE FUNCTION public.set_app_config(
  p_namespace TEXT,
  p_key TEXT,
  p_value JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.app_config (namespace, key, value, updated_by, updated_at)
  VALUES (p_namespace, p_key, p_value, auth.uid(), NOW())
  ON CONFLICT (namespace, key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = auth.uid(),
        updated_at = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_app_config FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_app_config TO service_role, authenticated;

COMMENT ON TABLE public.app_config IS 'Unified configuration. All limits/toggles/models live here. Hardcoding forbidden.';
