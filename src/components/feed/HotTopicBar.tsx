'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Topic {
  id: number;
  title: string;
  comments_count: number;
  likes_count: number;
  category: string;
}

export default function HotTopicBar() {
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    fetch('/api/feed/hot-topics')
      .then(r => r.json())
      .then(d => setTopics(d.topics ?? []))
      .catch(() => {});
  }, []);

  if (topics.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--sp-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>🔥</span>
        <span style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>핫토픽</span>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--accent-red)',
          animation: 'kd-pulse 2s infinite',
        }} />
      </div>
      <div className="kd-scroll-row" style={{ gap: 6, paddingBottom: 2 }}>
        {topics.map(t => {
          const score = t.comments_count + t.likes_count;
          const isFire = score > 20;
          return (
            <Link key={t.id} href={`/feed/${t.id}`} style={{
              flexShrink: 0, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)', textDecoration: 'none',
              border: `1px solid ${isFire ? 'rgba(239,68,68,0.15)' : 'var(--border)'}`,
              minWidth: 130, maxWidth: 180,
            }}>
              <div style={{
                fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {isFire ? '🔥 ' : ''}{t.title || '(제목없음)'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
                💬{t.comments_count} ❤️{t.likes_count}
              </div>
            </Link>
          );
        })}
      </div>
      <style>{`@keyframes kd-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
