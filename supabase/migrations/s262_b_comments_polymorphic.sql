-- s262 Phase B — comments polymorphic (entity_type / entity_id / tags / verification_badge)
-- IDEMPOTENT (IF NOT EXISTS) + 부분 REVERSIBLE.
-- DATA SOURCES:
--   comments.{post_id (BIGINT), is_deleted, created_at}
-- 변경:
--   1) ADD COLUMN entity_type TEXT, entity_id TEXT, tags TEXT[], verification_badge TEXT
--   2) UPDATE existing rows: entity_type='post', entity_id=post_id::text
--   3) ALTER post_id DROP NOT NULL (polymorphic stock/apt 댓글이 post_id NULL 허용 필요)
--   4) INDEX (entity_type, entity_id, created_at DESC) WHERE NOT is_deleted
-- REVERSIBILITY 한계:
--   ALTER ... SET NOT NULL 은 v1 deploy 후 polymorphic 댓글 (post_id NULL) 들어오면 불가능.
--   기존 row 의 post_id 데이터는 그대로 보존됨.
-- DOWN:
--   DROP INDEX IF EXISTS idx_comments_entity;
--   ALTER TABLE comments DROP COLUMN IF EXISTS verification_badge, DROP COLUMN IF EXISTS tags,
--                       DROP COLUMN IF EXISTS entity_id, DROP COLUMN IF EXISTS entity_type;
--   (post_id NOT NULL 복귀는 polymorphic NULL row 없을 때만 가능)

BEGIN;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS entity_type         TEXT,
  ADD COLUMN IF NOT EXISTS entity_id           TEXT,
  ADD COLUMN IF NOT EXISTS tags                TEXT[],
  ADD COLUMN IF NOT EXISTS verification_badge  TEXT;

-- 기존 row 백필: entity_type='post', entity_id=post_id::text (idempotent — WHERE entity_type IS NULL)
UPDATE public.comments
   SET entity_type = 'post',
       entity_id   = post_id::text
 WHERE entity_type IS NULL
   AND post_id IS NOT NULL;

-- post_id NULL 허용 (polymorphic stock/apt 댓글 지원). 기존 NOT NULL 제약 제거.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='comments'
      AND column_name='post_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE public.comments ALTER COLUMN post_id DROP NOT NULL;
  END IF;
END $$;

-- 신규 polymorphic 댓글은 entity_type + entity_id 필수 (CHECK constraint, idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_entity_or_post'
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_entity_or_post
        CHECK (
          (entity_type IS NOT NULL AND entity_id IS NOT NULL)
          OR post_id IS NOT NULL
        ) NOT VALID;
    -- NOT VALID: 기존 row 검증 skip (이미 백필 했지만 안전 장치)
    ALTER TABLE public.comments VALIDATE CONSTRAINT comments_entity_or_post;
  END IF;
END $$;

-- 인덱스: 카운트 조회용 (entity_type, entity_id, created_at DESC) WHERE NOT is_deleted
CREATE INDEX IF NOT EXISTS idx_comments_entity
  ON public.comments (entity_type, entity_id, created_at DESC)
  WHERE NOT is_deleted;

-- 검증
DO $$
DECLARE
  v_unbackfilled INT;
BEGIN
  SELECT count(*) INTO v_unbackfilled
  FROM public.comments
  WHERE entity_type IS NULL AND post_id IS NOT NULL;
  IF v_unbackfilled > 0 THEN
    RAISE EXCEPTION 's262-B: % comments rows still un-backfilled', v_unbackfilled;
  END IF;
END $$;

COMMIT;
