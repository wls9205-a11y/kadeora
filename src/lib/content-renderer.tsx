import Link from 'next/link';
import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;
const TAG_REGEX = /#([가-힣a-zA-Z0-9_]{1,30})/g;

export function renderContent(text: string): React.ReactNode[] {
  if (!text) return [];
  
  // Split by URLs first, then handle hashtags within non-URL parts
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  const combined = new RegExp(`(${URL_REGEX.source}|${TAG_REGEX.source})`, 'g');
  let match;

  while ((match = combined.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];
    if (matched.startsWith('http')) {
      // URL
      const display = matched.length > 50 ? matched.slice(0, 47) + '...' : matched;
      parts.push(
        <a key={`u${key++}`} href={matched} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--brand)', textDecoration: 'none', wordBreak: 'break-all' }}>
          🔗 {display}
        </a>
      );
    } else if (matched.startsWith('#')) {
      // Hashtag
      const tag = matched.slice(1);
      parts.push(
        <Link key={`t${key++}`} href={`/feed?tag=${encodeURIComponent(tag)}`}
          style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
          {matched}
        </Link>
      );
    }
    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
