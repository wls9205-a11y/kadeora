import { describe, it, expect } from "vitest";
import { sanitizeHTML, sanitizePlainText, isValidRedirectUrl, validateLength } from "@/lib/sanitize";

/**
 * Kent C. Dodds: "sanitize.ts 단위 테스트 — XSS 벡터 20개"
 */

describe("sanitizeHTML", () => {
  it("allows basic formatting tags", () => {
    expect(sanitizeHTML("<p>Hello <strong>world</strong></p>")).toContain("<strong>");
  });

  it("strips script tags", () => {
    expect(sanitizeHTML('<script>alert("xss")</script>')).not.toContain("script");
  });

  it("strips onerror attribute", () => {
    expect(sanitizeHTML('<img onerror="alert(1)" src="x">')).not.toContain("onerror");
  });

  it("strips onclick attribute", () => {
    expect(sanitizeHTML('<div onclick="alert(1)">click</div>')).not.toContain("onclick");
  });

  it("strips javascript: protocol in href", () => {
    const result = sanitizeHTML('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain("javascript:");
  });

  it("strips iframe tags", () => {
    expect(sanitizeHTML('<iframe src="evil.com"></iframe>')).not.toContain("iframe");
  });

  it("strips form tags", () => {
    expect(sanitizeHTML('<form action="evil.com"><input></form>')).not.toContain("form");
  });

  it("strips svg tags", () => {
    expect(sanitizeHTML('<svg onload="alert(1)"><circle></circle></svg>')).not.toContain("svg");
  });

  it("strips object/embed tags", () => {
    expect(sanitizeHTML('<object data="evil.swf"></object>')).not.toContain("object");
    expect(sanitizeHTML('<embed src="evil.swf">')).not.toContain("embed");
  });

  it("strips style tags", () => {
    expect(sanitizeHTML('<style>body{background:red}</style>')).not.toContain("style");
  });

  it("strips data attributes", () => {
    expect(sanitizeHTML('<div data-evil="payload">text</div>')).not.toContain("data-evil");
  });

  it("strips onmouseover", () => {
    expect(sanitizeHTML('<div onmouseover="alert(1)">hover</div>')).not.toContain("onmouseover");
  });

  it("strips onfocus", () => {
    expect(sanitizeHTML('<input onfocus="alert(1)">')).not.toContain("onfocus");
  });

  it("strips math tags", () => {
    expect(sanitizeHTML("<math><mi>evil</mi></math>")).not.toContain("math");
  });

  it("allows https links", () => {
    const result = sanitizeHTML('<a href="https://example.com">link</a>');
    expect(result).toContain("https://example.com");
  });

  it("strips vbscript protocol", () => {
    expect(sanitizeHTML('<a href="vbscript:alert(1)">link</a>')).not.toContain("vbscript");
  });

  it("strips encoded script tags", () => {
    expect(sanitizeHTML("&lt;script&gt;alert(1)&lt;/script&gt;")).not.toContain("<script>");
  });

  it("handles nested malicious tags", () => {
    expect(sanitizeHTML('<div><img src=x onerror="alert(1)"><script>alert(2)</script></div>')).not.toContain("onerror");
  });

  it("strips onsubmit", () => {
    expect(sanitizeHTML('<form onsubmit="steal()"><button></button></form>')).not.toContain("onsubmit");
  });

  it("preserves safe content", () => {
    const safe = "<p>주식 시장 <strong>분석</strong></p>";
    expect(sanitizeHTML(safe)).toContain("주식 시장");
    expect(sanitizeHTML(safe)).toContain("<strong>");
  });
});

describe("sanitizePlainText", () => {
  it("strips all HTML tags", () => {
    expect(sanitizePlainText("<b>bold</b><script>evil</script>")).toBe("boldevil");
  });

  it("handles empty string", () => {
    expect(sanitizePlainText("")).toBe("");
  });
});

describe("isValidRedirectUrl", () => {
  it("accepts relative paths", () => {
    expect(isValidRedirectUrl("/feed")).toBe(true);
    expect(isValidRedirectUrl("/write")).toBe(true);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isValidRedirectUrl("//evil.com")).toBe(false);
  });

  it("accepts kadeora domain", () => {
    expect(isValidRedirectUrl("https://kadeora.vercel.app/feed")).toBe(true);
  });

  it("rejects external domains", () => {
    expect(isValidRedirectUrl("https://evil.com")).toBe(false);
  });

  it("rejects http protocol", () => {
    expect(isValidRedirectUrl("http://kadeora.vercel.app")).toBe(false);
  });
});

describe("validateLength", () => {
  it("validates within range", () => {
    expect(validateLength("hello", 1, 10)).toBe(true);
  });

  it("rejects too short", () => {
    expect(validateLength("", 1, 10)).toBe(false);
  });

  it("rejects too long", () => {
    expect(validateLength("a".repeat(101), 1, 100)).toBe(false);
  });

  it("trims before validation", () => {
    expect(validateLength("   ", 1, 10)).toBe(false);
  });
});
