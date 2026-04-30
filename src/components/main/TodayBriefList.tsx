/**
 * TodayBriefList — 오늘의 브리프 (server).
 * MainBrief[] props. type 태그 + title + source_section.
 */
import Link from 'next/link';
import type { MainBrief } from './types';

interface Props {
  items: MainBrief[];
}

const TAG_STYLE: Record<MainBrief['type'], { bg: string; color: string }> = {
  AI: { bg: 'rgba(59,130,246,0.18)', color: 'var(--brand)' },
  HOT: { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
  INSIGHT: { bg: 'rgba(148,163,184,0.18)', color: 'var(--text-secondary)' },
};

export default function TodayBriefList({ items }: Props) {
  return (
    <section style={{ padding: 16, background: 'var(--bg-base)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>오늘의 브리프</h2>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center', border: '0.5px solid var(--border)', borderRadius: 8 }}>
          오늘 새로운 브리프 없음
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((b, i) => {
            const tag = TAG_STYLE[b.type];
            return (
              <li key={i}>
                <Link
                  href={b.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface)',
                    textDecoration: 'none', color: 'inherit', border: '0.5px solid var(--border)',
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: tag.bg, color: tag.color, flexShrink: 0,
                  }}>
                    [{b.type}]
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {b.title}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {b.source_section === 'blog' ? '블로그' : '커뮤니티'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
