'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

/**
 * 피드 상단 — 실시간 접속자 수 + 토론방 바로가기
 *
 * s170: Presence → polling 전환 (Supabase Realtime quota 보호)
 *   - 접속자: `get_active_visitors(minutes=60)` RPC (30초 폴링)
 *   - 활성 토론방: `discussion_topics WHERE expires_at IS NULL OR expires_at > now()` 중
 *     comment_count > 0 카운트 (2분 폴링)
 */
export default function LiveActivityBar() {
  const [online, setOnline] = useState<number | null>(null);
  const [activeRooms, setActiveRooms] = useState(0);

  // 접속자 수 — 30초 폴링
  useEffect(() => {
    const sb = createSupabaseBrowser() as any;
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await sb.rpc('get_active_visitors', { minutes: 60 });
        if (cancelled) return;
        const n = Number(data);
        setOnline(Number.isFinite(n) ? n : 0);
      } catch {
        if (!cancelled) setOnline(0);
      }
    };

    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // 활성 토론방 수 — 2분 폴링
  useEffect(() => {
    const sb = createSupabaseBrowser() as any;
    let cancelled = false;

    const load = async () => {
      try {
        const nowIso = new Date().toISOString();
        const { count } = await sb
          .from('discussion_topics')
          .select('id', { count: 'exact', head: true })
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          .gt('comment_count', 0);
        if (!cancelled) setActiveRooms(count || 0);
      } catch {
        if (!cancelled) setActiveRooms(0);
      }
    };

    load();
    const t = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // 접속자 0명이면 컴포넌트 숨김 (집계 전 상태 포함)
  if (online !== null && online <= 0) return null;

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
            {online === null ? '…' : online}
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
