-- ============================================================
-- KADEORA Supabase 마이그레이션 SQL
-- Supabase Dashboard → SQL Editor 에서 실행하세요
-- ============================================================

-- 1. discussion_messages 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS public.discussion_messages (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS 활성화
ALTER TABLE public.discussion_messages ENABLE ROW LEVEL SECURITY;

-- 읽기: 모든 인증된 사용자
CREATE POLICY "discussion_messages_read" ON public.discussion_messages
  FOR SELECT USING (true);

-- 작성: 인증된 사용자 본인
CREATE POLICY "discussion_messages_insert" ON public.discussion_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 삭제: 본인 메시지만
CREATE POLICY "discussion_messages_delete" ON public.discussion_messages
  FOR DELETE USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_discussion_messages_room_id ON public.discussion_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_messages_user_id ON public.discussion_messages(user_id);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_messages;

-- 2. notifications 테이블 Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. stock_quotes 테이블 Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_quotes;

-- 4. profiles increment_post_count RPC (게시글 작성시 카운트 증가)
CREATE OR REPLACE FUNCTION public.increment_post_count(uid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET post_count = COALESCE(post_count, 0) + 1,
      updated_at = NOW()
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 댓글 작성 시 알림 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
  post_title TEXT;
  commenter_nickname TEXT;
BEGIN
  -- 게시글 작성자 조회
  SELECT user_id, title INTO post_author_id, post_title
  FROM public.posts WHERE id = NEW.post_id;

  -- 본인 댓글이면 알림 안 보냄
  IF post_author_id IS NULL OR post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 댓글 작성자 닉네임 조회
  SELECT COALESCE(nickname, '익명') INTO commenter_nickname
  FROM public.profiles WHERE id = NEW.user_id;

  -- 알림 삽입
  INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
  VALUES (
    post_author_id,
    'comment',
    '댓글 알림',
    commenter_nickname || '님이 댓글을 남겼습니다: "' || LEFT(NEW.content, 50) || CASE WHEN char_length(NEW.content) > 50 THEN '...' ELSE '' END || '"',
    '/feed/' || NEW.post_id,
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_on_comment ON public.comments;
CREATE TRIGGER trigger_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- 6. 좋아요 시 알림 트리거
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
  liker_nickname TEXT;
BEGIN
  SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
  IF post_author_id IS NULL OR post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(nickname, '익명') INTO liker_nickname FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
  VALUES (post_author_id, 'like', '좋아요 알림', liker_nickname || '님이 게시글을 좋아합니다', '/feed/' || NEW.post_id, false);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_on_like ON public.post_likes;
CREATE TRIGGER trigger_notify_on_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- ============================================================
-- 완료! 위 SQL을 Supabase SQL Editor에서 실행하면
-- 실시간 채팅, 알림 자동 생성, 카운트 증가가 활성화됩니다.
-- ============================================================
