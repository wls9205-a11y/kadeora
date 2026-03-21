export interface FaqItem {
  question: string;
  answer: string;
}

export function parseFaqFromContent(content: string): FaqItem[] {
  const items: FaqItem[] = [];
  const lines = content.split('\n');
  let currentQ = '';
  let currentA = '';
  let inAnswer = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Q 패턴: "Q. 질문", "**Q.** 질문", "### Q: 질문", "Q1. 질문"
    const qMatch = trimmed.match(/^(?:\*\*)?Q\d*[.:]?\s*(?:\*\*)?\s*(.+)/i)
                || trimmed.match(/^#{1,3}\s*Q\d*[.:]?\s*(.+)/i);

    if (qMatch) {
      if (currentQ && currentA.trim()) {
        items.push({ question: currentQ.trim(), answer: currentA.trim() });
      }
      currentQ = qMatch[1].replace(/\*\*/g, '').trim();
      currentA = '';
      inAnswer = false;
      continue;
    }

    // A 패턴: "A. 답변", "**A.** 답변"
    const aMatch = trimmed.match(/^(?:\*\*)?A\d*[.:]?\s*(?:\*\*)?\s*(.+)/i);
    if (aMatch) {
      currentA = aMatch[1].replace(/\*\*/g, '').trim();
      inAnswer = true;
      continue;
    }

    // A 이후 계속되는 줄 (빈 줄이나 새 헤딩 전까지)
    if (inAnswer && currentQ && trimmed && !trimmed.startsWith('#')) {
      currentA += ' ' + trimmed.replace(/\*\*/g, '').trim();
    }

    // 빈 줄이면 A 수집 종료
    if (inAnswer && !trimmed) {
      inAnswer = false;
    }
  }

  // 마지막 항목
  if (currentQ && currentA.trim()) {
    items.push({ question: currentQ.trim(), answer: currentA.trim() });
  }

  return items;
}
