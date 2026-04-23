const BOT_UA_PATTERN =
  /googlebot|bingbot|yeti|daum(crawler)?|zumbot|baiduspider|yandex|facebookexternalhit|twitterbot|slurp|duckduckbot|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|amazonbot|applebot|meta-externalagent|linkedinbot|pinterestbot|bytespider|semrushbot|ahrefsbot|mj12bot/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_PATTERN.test(userAgent);
}
