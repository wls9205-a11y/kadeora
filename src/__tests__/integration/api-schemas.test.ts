import { describe, it, expect } from "vitest";
import { parseInput, PostCreateSchema, CommentCreateSchema, BugReportSchema, SearchSchema } from "@/lib/schemas";
import { createAppError, errorResponse, logError } from "@/lib/errors";

/**
 * Kent C. Dodds: "Testing Trophy — 통합 테스트가 가장 중요"
 */

describe("PostCreateSchema", () => {
  it("accepts valid post", () => {
    const result = parseInput(PostCreateSchema, {
      title: "삼성전자 실적 분석",
      content: "삼성전자 2026년 1분기 실적이 발표되었습니다.",
      category: "stock",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = parseInput(PostCreateSchema, { title: "", content: "내용", category: "free" });
    expect(result.success).toBe(false);
  });

  it("rejects title over 100 chars", () => {
    const result = parseInput(PostCreateSchema, { title: "a".repeat(101), content: "내용", category: "free" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = parseInput(PostCreateSchema, { title: "제목", content: "내용", category: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects content over 5000 chars", () => {
    const result = parseInput(PostCreateSchema, { title: "제목", content: "a".repeat(5001), category: "free" });
    expect(result.success).toBe(false);
  });
});

describe("CommentCreateSchema", () => {
  it("accepts valid comment", () => {
    const result = parseInput(CommentCreateSchema, {
      postId: "550e8400-e29b-41d4-a716-446655440000",
      content: "좋은 분석이네요!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = parseInput(CommentCreateSchema, { postId: "not-a-uuid", content: "댓글" });
    expect(result.success).toBe(false);
  });

  it("rejects comment over 1000 chars", () => {
    const result = parseInput(CommentCreateSchema, {
      postId: "550e8400-e29b-41d4-a716-446655440000",
      content: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("BugReportSchema", () => {
  it("accepts valid bug report", () => {
    const result = parseInput(BugReportSchema, { title: "버그입니다", content: "이렇게 하면 오류가 발생합니다" });
    expect(result.success).toBe(true);
  });

  it("rejects title under 2 chars", () => {
    const result = parseInput(BugReportSchema, { title: "a", content: "긴 내용입니다 여러글자" });
    expect(result.success).toBe(false);
  });
});

describe("SearchSchema", () => {
  it("accepts valid query", () => {
    expect(parseInput(SearchSchema, { q: "삼성전자" }).success).toBe(true);
  });

  it("rejects too short query", () => {
    expect(parseInput(SearchSchema, { q: "a" }).success).toBe(false);
  });
});

describe("Error system", () => {
  it("creates typed error with correct status", () => {
    const err = createAppError("RATE_LIMITED", { ip: "1.2.3.4" });
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.context?.ip).toBe("1.2.3.4");
  });

  it("generates error response", () => {
    const err = createAppError("AUTH_REQUIRED");
    const res = errorResponse(err);
    expect(res.status).toBe(401);
    expect(res.error.code).toBe("AUTH_REQUIRED");
    expect(res.error.messageKo).toContain("로그인");
  });

  it("logError handles Error objects", () => {
    expect(() => logError(new Error("test"), { route: "/api/test" })).not.toThrow();
  });

  it("logError handles non-Error values", () => {
    expect(() => logError("string error")).not.toThrow();
    expect(() => logError(null)).not.toThrow();
  });
});
