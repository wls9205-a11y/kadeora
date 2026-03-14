-- ============================================================
-- KADEORA Migration: v2.1.0
-- 5개 팀 피드백 반영 통합 마이그레이션
-- 전략기획팀: 데이터 수집 인프라 / 보안팀: RLS 강화 / 법무팀: 신고 시스템
-- ============================================================

-- ✅ 전략기획팀 요청: 검색 로그 테이블
CREATE TABLE IF NOT EXISTS public.search_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  clicked_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✅ 전략기획팀 요청: 열람 로그 테이블
CREATE TABLE IF NOT EXISTS public.view_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  duration_seconds INTEGER DEFAULT 0,
  scroll_depth REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✅ 전략기획팀 요청: 공유 로그 테이블
CREATE TABLE IF NOT EXISTS public.share_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('kakao', 'link', 'other')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✅ 전략기획팀 요청: 트렌딩 키워드 테이블
CREATE TABLE IF NOT EXISTS public.trending_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  heat_score REAL DEFAULT 0,
  category TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ✅ 전략기획팀 요청: 연속 접속 스트릭 테이블
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ✅ 법무팀 요청: 콘텐츠 신고 테이블
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'chat')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✅ 전략기획팀: 결제 테이블 (payment 페이지 복구)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shop_products(id),
  amount INTEGER NOT NULL,
  payment_key TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ✅ 프로필 테이블 확장: is_ghost 플래그, streak
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ============================================================
-- 인덱스 (성능 최적화 — 개발팀 피드백)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON public.search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_query ON public.search_logs(query);
CREATE INDEX IF NOT EXISTS idx_view_logs_post ON public.view_logs(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_logs_post ON public.share_logs(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_score ON public.trending_keywords(heat_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category_created ON public.posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_timestamp ON public.post_likes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON public.comments(created_at DESC);

-- ============================================================
-- RLS 정책 (보안팀 피드백: 전수 감사 반영)
-- ============================================================

-- search_logs: 본인만 조회, 서비스에서만 삽입
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_logs_insert" ON public.search_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "search_logs_select_own" ON public.search_logs FOR SELECT USING (auth.uid() = user_id);

-- view_logs: 서비스에서만 삽입
ALTER TABLE public.view_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_logs_insert" ON public.view_logs FOR INSERT WITH CHECK (true);

-- share_logs: 본인만 조회
ALTER TABLE public.share_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share_logs_insert" ON public.share_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "share_logs_select_own" ON public.share_logs FOR SELECT USING (auth.uid() = user_id);

-- trending_keywords: 전체 조회, 서비스만 수정
ALTER TABLE public.trending_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trending_select_all" ON public.trending_keywords FOR SELECT USING (true);

-- user_streaks: 본인만 조회/수정
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks_select_own" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "streaks_upsert_own" ON public.user_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "streaks_update_own" ON public.user_streaks FOR UPDATE USING (auth.uid() = user_id);

-- content_reports: 본인만 삽입, 본인만 조회
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_auth" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select_own" ON public.content_reports FOR SELECT USING (auth.uid() = reporter_id);

-- payments: 본인만 조회
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payments_insert_auth" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ✅ 보안팀: 기존 핵심 테이블 RLS 강화
-- profiles: 본인만 수정, 전체 조회 (공개 프로필)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- posts: 전체 조회, 본인만 수정/삭제
DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
CREATE POLICY "posts_insert_auth" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_update" ON public.posts;
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- comments: 전체 조회, 본인만 수정/삭제
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert_auth" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_delete" ON public.comments;
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE USING (auth.uid() = author_id);
