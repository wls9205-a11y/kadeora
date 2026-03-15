import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizePostInput, sanitizeId, sanitizeSearchQuery, sanitizeComment } from "@/lib/sanitize";

describe("sanitizeText", () => {
  it("removes script tags", () => {
    expect(sanitizeText('<script>alert("xss")</script>Hello')).not.toContain("<script>");
    expect(sanitizeText('<script>alert("xss")</script>Hello')).toContain("Hello");
  });
  it("removes event handlers", () => { expect(sanitizeText('<div onload="alert(1)">test</div>')).not.toContain("onload"); });
  it("removes javascript: protocol", () => { expect(sanitizeText("javascript:alert(1)")).not.toContain("javascript:"); });
  it("respects max length", () => { expect(sanitizeText("a".repeat(10000), 100).length).toBeLessThanOrEqual(100); });
  it("handles non-string input", () => { expect(sanitizeText(null)).toBe(""); expect(sanitizeText(undefined)).toBe(""); expect(sanitizeText(123 as unknown)).toBe(""); });
  it("trims whitespace", () => { expect(sanitizeText("  hello  ")).toBe("hello"); });
  it("collapses excessive newlines", () => { expect(sanitizeText("a\n\n\n\n\nb")).toBe("a\n\nb"); });
  it("removes iframe tags", () => { expect(sanitizeText('<iframe src="evil.com"></iframe>')).not.toContain("iframe"); });
  it("removes NULL bytes", () => { expect(sanitizeText("hello\0world")).toBe("helloworld"); });
});

describe("sanitizePostInput", () => {
  it("sanitizes title and content", () => {
    const result = sanitizePostInput({ title: '<script>x</script>Hello', content: "Good content", category: "test" });
    expect(result.title).not.toContain("<script>");
    expect(result.title).toContain("Hello");
    expect(result.content).toBe("Good content");
  });
  it("handles missing fields", () => {
    const result = sanitizePostInput({});
    expect(result.title).toBe("");
    expect(result.content).toBe("");
    expect(result.category).toBeNull();
  });
});

describe("sanitizeId", () => {
  it("removes special characters", () => { expect(sanitizeId("abc-123_def")).toBe("abc-123_def"); });
  it("strips injection attempts", () => { expect(sanitizeId("1; DROP TABLE")).toBe("1DROPTABLE"); });
  it("handles numbers", () => { expect(sanitizeId(42)).toBe("42"); });
  it("handles non-string", () => { expect(sanitizeId(null)).toBe(""); });
});

describe("sanitizeSearchQuery", () => {
  it("removes SQL keywords", () => {
    expect(sanitizeSearchQuery("SELECT * FROM users")).not.toContain("SELECT");
    expect(sanitizeSearchQuery("DROP TABLE posts")).not.toContain("DROP");
  });
  it("removes quotes and semicolons", () => {
    const result = sanitizeSearchQuery("'; DROP TABLE--");
    expect(result).not.toContain("'");
    expect(result).not.toContain(";");
  });
  it("preserves normal Korean queries", () => { expect(sanitizeSearchQuery("카더라 부동산")).toBe("카더라 부동산"); });
  it("preserves normal English queries", () => { expect(sanitizeSearchQuery("next.js 15")).toBe("next.js 15"); });
});

describe("sanitizeComment", () => {
  it("sanitizes comment text", () => {
    expect(sanitizeComment('<script>alert(1)</script>좋은 글이네요')).not.toContain("<script>");
    expect(sanitizeComment('<script>alert(1)</script>좋은 글이네요')).toContain("좋은 글이네요");
  });
  it("enforces max length", () => { expect(sanitizeComment("a".repeat(5000), 2000).length).toBeLessThanOrEqual(2000); });
});

describe("upload-validate", () => {
  it("module is importable", async () => {
    const mod = await import("@/lib/upload-validate");
    expect(typeof mod.validateUpload).toBe("function");
  });
});

describe("rate-limit", () => {
  it("module is importable", async () => {
    const mod = await import("@/lib/rate-limit");
    expect(typeof mod.rateLimit).toBe("function");
    expect(typeof mod.checkRateLimit).toBe("function");
    expect(typeof mod.getIp).toBe("function");
    expect(typeof mod.rateLimitResponse).toBe("function");
  });
});
