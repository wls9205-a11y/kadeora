import { z } from 'zod';

// 게시글 작성
export const PostCreateSchema = z.object({
  title: z.string().min(2, '제목은 2자 이상').max(200, '제목은 200자 이하'),
  content: z.string().min(5, '내용은 5자 이상').max(10000, '내용은 10000자 이하'),
  category: z.enum(['stock', 'apt', 'local', 'free']).default('free'),
  tag: z.string().max(50).optional().nullable(),
  is_anonymous: z.boolean().optional().default(false),
  region_id: z.string().max(50).optional(),
  images: z.array(z.string().url()).max(5).optional().default([]),
  tags: z.array(z.string().max(30)).max(5).optional().default([]),
});

// 댓글 작성
export const CommentCreateSchema = z.object({
  content: z.string().min(1, '댓글을 입력해주세요').max(2000, '2000자 이하'),
  post_id: z.number().int().positive('유효한 게시글 ID'),
  parent_id: z.number().int().positive().nullable().optional(),
});

// 신고
export const ReportSchema = z.object({
  reason: z.string().min(1, '신고 사유 필수'),
  details: z.string().max(1000).optional(),
  postId: z.number().int().positive().optional(),
  commentId: z.number().int().positive().optional(),
  messageId: z.string().uuid().optional(),
});

// 검증 헬퍼: 파싱 실패 시 에러 메시지 반환
export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.errors.map(e => e.message).join(', ');
    return { data: null, error: msg };
  }
  return { data: result.data, error: null };
}
