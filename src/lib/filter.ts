const BLOCKED_WORDS = [
  '시발', '씨발', '개새끼', '병신', '지랄', '꺼져', '미친놈',
  '씹', '좆', '창녀', '걸레',
  'fuck', 'shit', 'bitch', 'asshole',
];

const SPAM_REPEAT = /(.)\1{5,}/;

export function filterContent(text: string): { isBlocked: boolean; reason?: string; filtered: string } {
  if (!text) return { isBlocked: false, filtered: text };
  const lower = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return { isBlocked: true, reason: '부적절한 내용이 포함되어 있습니다', filtered: text.replace(new RegExp(word, 'gi'), '***') };
    }
  }
  if (SPAM_REPEAT.test(text)) {
    return { isBlocked: true, reason: '도배성 내용이 감지됐습니다', filtered: text };
  }
  const links = (text.match(/https?:\/\/[^\s]+/g) ?? []);
  if (links.length >= 3) {
    return { isBlocked: true, reason: '링크 도배가 감지됐습니다', filtered: text };
  }
  return { isBlocked: false, filtered: text };
}

export function softFilter(text: string): string {
  let result = text;
  for (const word of BLOCKED_WORDS) {
    result = result.replace(new RegExp(word, 'gi'), '***');
  }
  return result;
}
