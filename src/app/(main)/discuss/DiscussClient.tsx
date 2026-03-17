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

const ROOM_META: Record<string, { bg: string; emoji: string; desc: string }> = {
  stock: { bg: 'var(--info-bg)', emoji: '🇰🇷', desc: 'KOSPI·KOSDAQ 종목 토론' },
  us_stock: { bg: 'var(--success-bg)', emoji: '🌎', desc: 'NYSE·NASDAQ 종목 토론' },
  apt: { bg: 'var(--warning-bg)', emoji: '🏠', desc: '청약·분양·재건축 정보' },
  free: { bg: 'var(--brand-light)', emoji: '💬', desc: '자유 주제 소문 공유' },
};

const ROOM_KEY_EMOJI: Record<string, string> = {
  general_us_stock: '🌍',
};

export default function DiscussClient({ rooms }: { rooms: DiscussionRoom[] }) {
  const [active, setActive] = useState<DiscussionRoom | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>💬 카더라 토론방</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>소문을 나누고 함께 분석해요</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {rooms.map(room => {
          const meta = ROOM_META[room.room_type] ?? { bg: 'var(--bg-hover)', emoji: '💬', desc: '' };
          const emoji = (room.room_key && ROOM_KEY_EMOJI[room.room_key]) ? ROOM_KEY_EMOJI[room.room_key] : meta.emoji;
          return (
            <div key={room.id} onClick={() => setActive(room)} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActive(room)}
              aria-label={`${room.display_name} 토론방 입장`}
              style={{
                background: meta.bg, border: '1px solid var(--border)',
                borderRadius: 16, padding: '20px 24px',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 16,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              <div style={{ fontSize: 48 }}>{emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {room.display_name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {room.description ?? meta.desc}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  💬 {((room as any).messages_count ?? room.post_count ?? 0).toLocaleString()}개 메시지
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>입장 →</div>
            </div>
          );
        })}
      </div>

      {/* 토론방 개설 */}
      <div style={{
        marginTop: 24, textAlign: 'center',
        padding: 20, border: '1px dashed var(--border)',
        borderRadius: 16,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>➕</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>나만의 토론방 개설</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>특정 종목이나 지역 현장의 전용 토론방을 만들 수 있어요</div>
        <a href="/shop/megaphone" style={{
          display: 'inline-block', background: 'var(--brand)', color: 'var(--text-inverse)',
          padding: '10px 24px', borderRadius: 20, textDecoration: 'none', fontSize: 14, fontWeight: 700,
        }}>상점에서 개설권 구매</a>
      </div>

      {active && <ChatRoom room={active} user={user} onClose={() => setActive(null)} />}
    </div>
  );
}
