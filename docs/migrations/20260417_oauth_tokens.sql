-- ============================================================
-- 20260417_oauth_tokens.sql — OAuth 토큰 영구 저장
-- 환경변수에서 분리 → DB 저장 → refresh rotation 자동화
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  provider TEXT PRIMARY KEY,                  -- 'naver_cafe', 'naver_blog', 'kakao_channel'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  client_id TEXT,
  client_secret TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,         -- cafeId, menuId, etc.
  last_refreshed_at TIMESTAMPTZ,
  refresh_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- service_role 만 접근 (어드민 API에서 service_role 사용)
DROP POLICY IF EXISTS "oauth_tokens_service_only" ON public.oauth_tokens;
CREATE POLICY "oauth_tokens_service_only" ON public.oauth_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires
  ON public.oauth_tokens(refresh_token_expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_needs_refresh
  ON public.oauth_tokens(access_token_expires_at)
  WHERE access_token_expires_at IS NOT NULL;

COMMENT ON TABLE public.oauth_tokens IS 'OAuth tokens persistent storage. refresh_token rotation handled automatically.';
COMMENT ON COLUMN public.oauth_tokens.metadata IS 'Provider-specific config: e.g. {"cafeId": "12345", "menuId": "30"}';
