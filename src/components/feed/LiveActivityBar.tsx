'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

/**
 * 피드 상단 — 실시간 접속자 수 + 토론방 바로가기
 * - 접속자: Supabase Realtime Presence (channel='kd-online')
 * - 활성 토론방 수: discussion_topics 최근 24h comment_count > 0
 */
export default function LiveActivityBar() {
  const [online, setOnline] = useState(0);
  const [activeRooms, setActiveRooms] = useState(0);

  // 활성 토론방 수 (단발 + 2분 폴링)
  useEffect(() => {
    const sb = createSupabaseBrowser() as any;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadRooms = async () => {
      try {
        const since = new Date(Date.now() - 24 * 3600_000).toISOString();
        const { count } = await sb
          .from('discussion_topics')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since)
          .gt('comment_count', 0);
        setActiveRooms(count || 0);
      } catch {
        setActiveRooms(0);
      }
    };

    loadRooms();
    timer = setInterval(loadRooms, 120_000);
    return () => { if (timer) clearInterval(timer); };
  }, []);

  // Realtime Presence — 접속자 수
  useEffect(() => {
    const sb = createSupabaseBrowser() as any;
    const userKey = (() => {
      try {
        const k = sessionStorage.getItem('kd_presence_key');
        if (k) return k;
        const next = (crypto as any)?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem('kd_presence_key', next);
        return next;
      } catch {
        return `anon-${Date.now()}`;
      }
    })();

    const channel = sb.channel('kd-online', {
      config: { presence: { key: userKey } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnline(Object.keys(state).length);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          try { await channel.track({ online_at: new Date().toISOString() }); } catch {}
        }
      });

    return () => {
      try { sb.removeChannel(channel); } catch {}
    };
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', margin: '4px 0 8px',
      borderRadius: 10, background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
    }}>
      {/* 왼쪽: 접속자 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: '#22C55E',
          }} />
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: '#22C55E', opacity: 0.4,
            animation: 'kdPulseRing 1.6s ease-out infinite',
          }} />
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <span style={{ color: '#22C55E', fontWeight: 700 }}>
            {online > 0 ? online : '—'}
          </span>
          {' '}명 접속중
        </span>
      </div>

      {/* 오른쪽: 실시간 토론 */}
      <Link href="/discuss" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 8,
        background: 'var(--bg-hover)', color: 'var(--brand)',
        fontSize: 12, fontWeight: 700, textDecoration: 'none',
        border: '1px solid var(--border)', position: 'relative',
      }}>
        <MessageSquare size={12} strokeWidth={2.2} />
        실시간 토론
        {activeRooms > 0 && (
          <span style={{
            minWidth: 16, height: 16, padding: '0 5px',
            borderRadius: 8, background: '#EF4444', color: '#fff',
            fontSize: 10, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{activeRooms > 99 ? '99+' : activeRooms}</span>
        )}
      </Link>

      <style jsx>{`
        @keyframes kdPulseRing {
          0% { transform: scale(1); opacity: 0.5; }
          80% { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
