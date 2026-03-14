import DOMPurify from "isomorphic-dompurify";

// ✅ A-grade Kim Zetter: 강화된 XSS 방어

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
  "h1", "h2", "h3", "blockquote", "code", "pre",
];

const ALLOWED_ATTRS = ["href", "title", "rel"];

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["script", "style", "iframe", "form", "input", "object", "embed", "svg", "math"],
    FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover", "onfocus", "onblur", "onsubmit"],
    ADD_ATTR: ["target"],
    // href must be http/https only (block javascript: protocol)
    ALLOWED_URI_REGEXP: /^(?:(?:https?):\/\/|mailto:|tel:)/i,
  });
}

export function sanitizePlainText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

// Strict URL validation — Open Redirect 방지
const ALLOWED_HOSTS = new Set([
  "kadeora.vercel.app",
  "www.kadeora.vercel.app",
]);

export function isValidRedirectUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true; // relative path OK
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

// Input length validation helper
export function validateLength(input: string, min: number, max: number): boolean {
  const trimmed = input.trim();
  return trimmed.length >= min && trimmed.length <= max;
}
