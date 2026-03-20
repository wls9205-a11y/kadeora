const BLOCKED_WORDS = [
  '시발', '씨발', '개새끼', '병신', '지랄', '꺼져', '미친놈',
  '씹', '좆', '창녀', '걸레',
  'fuck', 'shit', 'bitch', 'asshole',
];

const SPAM_REPEAT = /(.)\1{5,}/;

// 자본시장법 위반 가능성 패턴 (자동 감지)
const INVESTMENT_FRAUD_PATTERNS = [
  '확정수익', '원금보장', '100%\\s*수익', '무조건\\s*수익',
  '리딩방', '비밀\\s*종목', '급등\\s*예정', '내부\\s*정보',
  '선착순\\s*매수', '지금\\s*안\\s*사면', '마지막\\s*기회',
  '월\\s*\\d+%', '일\\s*\\d+%', '연\\s*\\d{2,}%',
];
const FRAUD_REGEX = new RegExp(INVESTMENT_FRAUD_PATTERNS.join('|'), 'i');

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
  if (FRAUD_REGEX.test(text)) {
    return { isBlocked: true, reason: '투자 관련 허위사실 유포 의심 표현이 포함되어 있습니다. 자본시장법에 의해 처벌받을 수 있습니다.', filtered: text };
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
