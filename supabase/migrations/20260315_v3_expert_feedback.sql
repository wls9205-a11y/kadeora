-- ============================================================
-- KADEORA Migration: v3.0 — 전문가 피드백 + 팀 합의 반영
-- ============================================================

-- ✅ 박노형 교수 피드백: 동의 상태를 서버에 저장
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_analytics BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ;

-- ✅ 박노형 교수 피드백: 만 14세 미만 가입 제한
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- ✅ Casey Winters 피드백: 초대제 시스템
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  used_by UUID REFERENCES auth.users(id),
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_select_own" ON public.invite_codes FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = used_by);
CREATE POLICY "invite_insert_auth" ON public.invite_codes FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "invite_update_use" ON public.invite_codes FOR UPDATE USING (is_used = false);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);

-- ✅ 탈퇴 후 30일 보관 정책 지원
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- ✅ Rand Fishkin 피드백: 게시글별 관련 글 추천용 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_category_likes ON public.posts(category, like_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_fulltext ON public.posts USING gin(to_tsvector('korean', title || ' ' || content));
