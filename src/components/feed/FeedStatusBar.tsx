'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function FeedStatusBar() {
  const [active, setActive] = useState(0);
  const [now, setNow] = useState(new Date());
  const [stats, setStats] = useState({ posts: 0, comments: 0, signups: 0 });

  useEffect(() => {
    const sb = createSupabaseBrowser() as any;

    const fetchData = async () => {
      // 활동중 유저
      const v = await sb.rpc('get_active_visitors', { minutes: 60 }).then((r: any) => r.data ?? 0).catch(() => 0);
      setActive(v);

      // 오늘 통계
      const today = new Date().toISOString().split('T')[0];
      const [postsRes, commentsRes, signupsRes] = await Promise.all([
        sb.from('posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', today).then((r: any) => r.count ?? 0).catch(() => 0),
        sb.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', today).then((r: any) => r.count ?? 0).catch(() => 0),
        sb.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today).then((r: any) => r.count ?? 0).catch(() => 0),
      ]);
      setStats({ posts: postsRes, comments: commentsRes, signups: signupsRes });
    };

    fetchData();
    const t1 = setInterval(fetchData, 60000);
    const t2 = setInterval(() => setNow(new Date()), 60000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const m = now.getMonth() + 1;
  const d = now.getDate();
  const w = ['일','월','화','수','목','금','토'][now.getDay()];
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <div className="feed-status-bar" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 6px', background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-sm)', marginBottom: 8,
      border: '1px solid var(--border)',
    }}>
      {/* 날짜/시간 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 6,
        background: 'var(--bg-hover)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{m}.{d}</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({w})</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>{hh}:{mm}</span>
      </div>

      {/* 오늘 통계 */}
      <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {[
          { icon: '✏️', val: stats.posts },
          { icon: '💬', val: stats.comments },
          { icon: '👋', val: stats.signups },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px' }}>
            <span style={{ fontSize: 10 }}>{s.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* 실시간 활동 */}
      {active > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(34,197,94,0.06)', flexShrink: 0,
        }}>
          <span className="kd-pulse-dot" style={{ width: 5, height: 5, background: '#22C55E' }} />
          <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 700 }}>{active}</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>활동중</span>
        </div>
      )}
    </div>
  );
}
