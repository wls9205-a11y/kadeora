'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { DiscussionRoom } from '@/types/database';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

const ChatRoom = dynamic(() => import('./ChatRoom'), {
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%' }} className="animate-spin" />
    </div>
  ),
  ssr: false,
});

const CATS = [{ key: 'all', label: '전체' }, { key: 'stock', label: '📈 국내주식' }, { key: 'us_stock', label: '🇺🇸 해외주식' }, { key: 'apt', label: '🏠 청약' }, { key: 'free', label: '💬 자유' }];
const SORTS = [{ key: 'popular', label: '🔥 인기' }, { key: 'messages', label: '💬 활성' }, { key: 'latest', label: '🕐 최신' }];

const CAT_COLORS: Record<string, string> = {
  stock: 'var(--brand)',
  us_stock: 'var(--warning)',
  apt: 'var(--success)',
  free: 'var(--info)',
};

export default function DiscussClient({ rooms }: { rooms: DiscussionRoom[] }) {
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('popular');
  const [active, setActive] = useState<DiscussionRoom | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const filtered = rooms
    .filter(r => cat === 'all' || r.room_type === cat || r.room_key?.startsWith(cat) || (cat === 'us_stock' && r.room_type === 'us_stock'))
    .sort((a, b) =>
      sort === 'popular' ? (b.member_count ?? 0) - (a.member_count ?? 0)
      : sort === 'messages' ? (b.post_count ?? 0) - (a.post_count ?? 0)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>💬 토론방</h1>
      </div>

      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
          {CATS.map(f => (
            <button key={f.key} onClick={() => setCat(f.key)}
              aria-pressed={cat === f.key}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: cat === f.key ? 'var(--brand)' : 'transparent', color: cat === f.key ? 'var(--text-inverse, #fff)' : 'var(--text-secondary)', transition: 'all 0.15s' }}
            >{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', marginLeft: 'auto' }}>
          {SORTS.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              style={{ padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: sort === s.key ? 'var(--bg-hover)' : 'transparent', color: sort === s.key ? 'var(--text-primary)' : 'var(--text-tertiary)', transition: 'all 0.15s' }}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* 방 목록 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 8 }}>
        {filtered.map(room => {
          const catColor = CAT_COLORS[room.room_type] ?? 'var(--text-secondary)';
          return (
            <div key={room.id} onClick={() => setActive(room)} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActive(room)}
              aria-label={`${room.display_name} 토론방 열기`}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: catColor + '20', color: catColor }}>
                  {room.room_type === 'stock' ? '국내주식' : room.room_type === 'us_stock' ? '해외주식' : room.room_type === 'apt' ? '청약' : '자유'}
                </span>
                {room.is_active && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--success)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                    LIVE
                  </span>
                )}
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{room.display_name}</h3>
              {room.description && (
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                  {room.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                <span>👥 {(room.member_count ?? 0).toLocaleString()}</span>
                <span>💬 {(room.post_count ?? 0).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ChatRoom 모달 — dynamic import로 lazy loading */}
      {active && <ChatRoom room={active} user={user} onClose={() => setActive(null)} />}
    </div>
  );
}