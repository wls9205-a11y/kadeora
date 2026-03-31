'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

/**
 * 실시간 활동 지표 — 실제 데이터 기반
 * 
 * - 최근 30분 내 고유 방문자 수 (page_views DISTINCT visitor_id)
 * - 최근 1시간 내 새 글 수
 * - 가짜 랜덤 수치 완전 제거 (2026-04-01)
 */
export default function LiveActivityIndicator() {
  const [activeVisitors, setActiveVisitors] = useState(0);
  const [recentPosts, setRecentPosts] = useState(0);

  useEffect(() => {
    const sb = createSupabaseBrowser() as any;

    const fetchActivity = async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

      const [visitorsR, postsR] = await Promise.all([
        sb.rpc('get_active_visitors', { minutes: 30 }).then((r: any) => r.data ?? 0).catch(() => 0),
        sb.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', oneHourAgo).then((r: any) => r.count ?? 0).catch(() => 0),
      ]);

      setActiveVisitors(visitorsR);
      setRecentPosts(postsR);
    };

    fetchActivity();
    const timer = setInterval(fetchActivity, 60000);
    return () => clearInterval(timer);
  }, []);

  if (activeVisitors <= 0 && recentPosts <= 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', fontSize: 11, color: 'var(--text-tertiary)' }}>
      {activeVisitors > 0 && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span className="kd-pulse-dot" style={{ width: 5, height: 5, background: '#22C55E' }} />
          <span style={{ color: '#22C55E', fontWeight: 600 }}>{activeVisitors}명</span> 활동 중
        </span>
      )}
      {recentPosts > 0 && (
        <>
          {activeVisitors > 0 && <span style={{ color: 'var(--border)' }}>·</span>}
          <span>최근 1시간 <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{recentPosts}</span>개 새 글</span>
        </>
      )}
    </div>
  );
}
