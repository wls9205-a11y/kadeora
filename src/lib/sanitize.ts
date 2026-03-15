function removeDangerous(str: string): string {
  let s = str;
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  s = s.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/data\s*:\s*(?:text\/html|application\/xhtml)/gi, "");
  s = s.replace(/vbscript\s*:/gi, "");
  s = s.replace(/expression\s*\(/gi, "");
  s = s.replace(/<\s*\/?\s*(iframe|embed|object|applet|form)\b[^>]*>/gi, "");
  return s;
}

export function sanitizeText(input: unknown, maxLen = 5000): string {
  if (typeof input !== "string") return "";
  let s = input.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  s = removeDangerous(s);
  s = s.replace(/\0/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

export function sanitizePostInput(body: { title?: unknown; content?: unknown; category?: unknown; tag?: unknown }) {
  return {
    title: sanitizeText(body.title, 200),
    content: sanitizeText(body.content, 10000),
    category: sanitizeText(body.category, 50) || null,
    tag: sanitizeText(body.tag, 50) || null,
  };
}

export function sanitizeId(input: unknown): string {
  if (typeof input === "number") return String(input);
  if (typeof input !== "string") return "";
  return input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
}

export function sanitizeSearchQuery(input: unknown, maxLen = 200): string {
  if (typeof input !== "string") return "";
  let s = input.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  s = s.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|DECLARE)\b)/gi, "");
  s = s.replace(/['"`;\\]/g, "");
  s = s.replace(/--+/g, "-");
  s = s.replace(/\0/g, "");
  return s.trim();
}

export function sanitizeComment(input: unknown, maxLen = 2000): string {
  return sanitizeText(input, maxLen);
}
