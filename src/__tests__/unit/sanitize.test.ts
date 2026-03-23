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
  it("strips all HTML tags", () => {
    expect(sanitizeText("<b>bold</b>")).toBe("bold");
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
  it("strips HTML from queries", () => {
    expect(sanitizeSearchQuery('<script>alert(1)</script>삼성전자')).toContain("삼성전자");
    expect(sanitizeSearchQuery('<script>alert(1)</script>삼성전자')).not.toContain("script");
  });

  it("enforces max length", () => {
    expect(sanitizeSearchQuery("a".repeat(500), 200).length).toBeLessThanOrEqual(200);
  });
});

describe("sanitizeComment", () => {
  it("strips HTML from comments", () => {
    expect(sanitizeComment("<b>좋은 글입니다</b>")).toBe("좋은 글입니다");
  });

  it("enforces max length", () => {
    expect(sanitizeComment("a".repeat(3000), 2000).length).toBeLessThanOrEqual(2000);
  });
});
