import { z } from "zod";

/**
 * API 입력 검증 스키마 — Theo: "수동 if (!title) 체크는 누락의 온상"
 * 모든 API는 이 스키마로 파싱한 뒤 처리
 */

export const PostCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(100, "제목은 100자 이하"),
  content: z.string().min(1, "내용을 입력하세요").max(5000, "내용은 5000자 이하"),
  category: z.enum(["stock", "apt", "community", "free", "bug"]),
  imageUrls: z.array(z.string().url()).max(5).nullable().optional(),
});

export const CommentCreateSchema = z.object({
  postId: z.coerce.number().int().positive("유효한 게시글 ID가 필요합니다"),
  content: z.string().min(1, "댓글을 입력하세요").max(1000, "댓글은 1000자 이하"),
  parentId: z.string().uuid().nullable().optional(),
});

export const BugReportSchema = z.object({
  title: z.string().min(2, "제목은 2자 이상").max(100, "제목은 100자 이하"),
  content: z.string().min(10, "내용은 10자 이상").max(5000, "내용은 5000자 이하"),
});

export const SearchSchema = z.object({
  q: z.string().min(2, "검색어는 2자 이상").max(100),
});

export const ReportSchema = z.object({
  targetType: z.enum(["post", "comment", "chat"]),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export const PaymentCreateSchema = z.object({
  productId: z.string().uuid(),
  orderId: z.string().min(1),
  amount: z.number().positive().int(),
  orderName: z.string().min(1).max(200),
});

/** Helper: parse and return Result type */
export function parseInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((i) => i.message),
  };
}
