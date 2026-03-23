import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeSearchQuery, sanitizeComment } from "@/lib/sanitize";
import { sanitizeHtml } from "@/lib/sanitize-html";

describe("sanitizeHtml", () => {
  it("strips script tags", () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).not.toContain("script");
  });

  it("strips onerror attribute", () => {
    expect(sanitizeHtml('<img onerror="alert(1)" src="x">')).not.toContain("onerror");
  });

  it("strips javascript: protocol in href", () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain("javascript:");
  });

  it("strips iframe tags", () => {
    expect(sanitizeHtml('<iframe src="evil.com"></iframe>')).not.toContain("iframe");
  });

  it("preserves safe content", () => {
    const safe = "<p>주식 시장 <strong>분석</strong></p>";
    expect(sanitizeHtml(safe)).toContain("주식 시장");
  });
});

describe("sanitizeText", () => {
  it("preserves safe HTML tags (only strips dangerous ones)", () => {
    // sanitizeText keeps safe tags like <b>, only removes <script>, <iframe>, etc.
    expect(sanitizeText("<b>bold</b>")).toBe("<b>bold</b>");
  });

  it("handles empty/null input", () => {
    expect(sanitizeText("")).toBe("");
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
  });

  it("trims whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  it("enforces maxLen", () => {
    expect(sanitizeText("a".repeat(100), 10).length).toBeLessThanOrEqual(10);
  });
});

describe("sanitizeSearchQuery", () => {
  it("strips SQL injection patterns from queries", () => {
    expect(sanitizeSearchQuery('SELECT * FROM users')).not.toContain("SELECT");
    expect(sanitizeSearchQuery("삼성전자' OR 1=1")).toContain("삼성전자");
    expect(sanitizeSearchQuery("삼성전자' OR 1=1")).not.toContain("'");
  });

  it("enforces max length", () => {
    expect(sanitizeSearchQuery("a".repeat(500), 200).length).toBeLessThanOrEqual(200);
  });
});

describe("sanitizeComment", () => {
  it("preserves safe HTML in comments (strips dangerous only)", () => {
    // sanitizeComment = sanitizeText → keeps safe tags
    expect(sanitizeComment("<b>좋은 글입니다</b>")).toBe("<b>좋은 글입니다</b>");
  });

  it("enforces max length", () => {
    expect(sanitizeComment("a".repeat(3000), 2000).length).toBeLessThanOrEqual(2000);
  });
});
