import Link from 'next/link';
import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;
const TAG_REGEX = /#([가-힣a-zA-Z0-9_]{1,30})/g;

export interface EntityMap {
  stocks?: { name: string; symbol: string }[];
  apts?: { name: string; slug: string }[];
}

/**
 * 피드/게시글 본문 렌더링
 * - URL → 클릭 가능 링크
 * - #해시태그 → 태그 검색 링크
 * - 종목명/현장명 → 해당 페이지 자동 링크 (entities 전달 시)
 */
export function renderContent(text: string, entities?: EntityMap): React.ReactNode[] {
  if (!text) return [];

  // 1단계: 엔티티 사전에서 본문 내 매칭되는 것 찾기
  const entityMatches: { start: number; end: number; name: string; href: string }[] = [];

  if (entities) {
    // 종목명 매칭 (3글자 이상만 — 오탐 방지)
    for (const s of entities.stocks || []) {
      if (s.name.length < 3) continue;
      let idx = text.indexOf(s.name);
      while (idx !== -1) {
        entityMatches.push({ start: idx, end: idx + s.name.length, name: s.name, href: `/stock/${s.symbol}` });
        idx = text.indexOf(s.name, idx + s.name.length);
      }
      // 영문 심볼도 매칭 (4글자 이상, 대문자)
      if (s.symbol.length >= 3 && /^[A-Z]+$/.test(s.symbol)) {
        const re = new RegExp(`\\b${s.symbol}\\b`, 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
          // 이미 같은 위치에 name 매칭이 있으면 스킵
          if (!entityMatches.some(e => e.start === m!.index)) {
            entityMatches.push({ start: m.index, end: m.index + s.symbol.length, name: s.symbol, href: `/stock/${s.symbol}` });
          }
        }
      }
    }

    // 현장명 매칭 (4글자 이상만)
    for (const a of entities.apts || []) {
      if (a.name.length < 4) continue;
      let idx = text.indexOf(a.name);
      while (idx !== -1) {
        entityMatches.push({ start: idx, end: idx + a.name.length, name: a.name, href: `/apt/${a.slug}` });
        idx = text.indexOf(a.name, idx + a.name.length);
      }
    }
  }

  // 중복/겹침 제거 — 긴 매칭 우선
  entityMatches.sort((a, b) => b.name.length - a.name.length || a.start - b.start);
  const usedRanges: { start: number; end: number }[] = [];
  const filteredEntities = entityMatches.filter(e => {
    if (usedRanges.some(r => e.start < r.end && e.end > r.start)) return false;
    usedRanges.push({ start: e.start, end: e.end });
    return true;
  });
  filteredEntities.sort((a, b) => a.start - b.start);

  // 2단계: URL + 해시태그 + 엔티티 통합 처리
  const combined = new RegExp(`(${URL_REGEX.source}|${TAG_REGEX.source})`, 'g');
  const allMarks: { start: number; end: number; type: 'url' | 'tag' | 'entity'; text: string; href: string }[] = [];

  let match;
  while ((match = combined.exec(text)) !== null) {
    const m = match[0];
    if (m.startsWith('http')) {
      allMarks.push({ start: match.index, end: match.index + m.length, type: 'url', text: m, href: m });
    } else if (m.startsWith('#')) {
      allMarks.push({ start: match.index, end: match.index + m.length, type: 'tag', text: m, href: `/feed?tag=${encodeURIComponent(m.slice(1))}` });
    }
  }

  // 엔티티 추가 (URL/태그와 겹치지 않는 것만)
  for (const e of filteredEntities) {
    if (!allMarks.some(m => e.start < m.end && e.end > m.start)) {
      allMarks.push({ start: e.start, end: e.end, type: 'entity', text: e.name, href: e.href });
    }
  }

  allMarks.sort((a, b) => a.start - b.start);

  // 3단계: 렌더링
  if (allMarks.length === 0) return [text];

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;

  for (const mark of allMarks) {
    if (mark.start > lastIdx) {
      parts.push(text.slice(lastIdx, mark.start));
    }

    if (mark.type === 'url') {
      const display = mark.text.length > 50 ? mark.text.slice(0, 47) + '...' : mark.text;
      parts.push(
        <a key={`u${key++}`} href={mark.href} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--brand)', textDecoration: 'none', wordBreak: 'break-all' }}>
          🔗 {display}
        </a>
      );
    } else if (mark.type === 'tag') {
      parts.push(
        <Link key={`t${key++}`} href={mark.href}
          style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
          {mark.text}
        </Link>
      );
    } else if (mark.type === 'entity') {
      parts.push(
        <Link key={`e${key++}`} href={mark.href}
          style={{ color: 'var(--brand)', textDecoration: 'none', borderBottom: '1px dashed var(--brand)', paddingBottom: 1 }}>
          {mark.text}
        </Link>
      );
    }

    lastIdx = mark.end;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}
