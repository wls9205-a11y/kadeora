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
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, alignItems: 'center' }}>
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 10px', borderRadius: 'var(--radius-xl, 20px)',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)',
        }}>
          <span style={{ fontSize: 11 }}>🔥</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-red, #EF4444)' }}>핫토픽</span>
        </div>
        {topics.map(t => {
          const score = t.comments_count + t.likes_count;
          const isFire = score > 20;
          return (
            <Link key={t.id} href={`/feed/${t.id}`} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 'var(--radius-xl, 20px)',
              background: 'var(--bg-surface)', textDecoration: 'none',
              border: `1px solid ${isFire ? 'rgba(239,68,68,0.1)' : 'var(--border)'}`,
            }}>
              <span style={{
                fontSize: 12, color: 'var(--text-primary)', fontWeight: 500,
                whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {isFire ? '🔥 ' : ''}{t.title || '(제목없음)'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                {t.comments_count + t.likes_count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
