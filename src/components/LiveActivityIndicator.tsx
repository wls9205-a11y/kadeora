'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function LiveActivityIndicator() {
  const [onlineCount, setOnlineCount] = useState(0);
  const [recentPosts, setRecentPosts] = useState(0);

  useEffect(() => {
    // 시뮬레이션: 실제로는 Supabase Realtime Presence 사용
    // 초기 랜덤 시드 (실제 접속자가 쌓이기 전까지)
    const base = 12 + Math.floor(Math.random() * 30);
    setOnlineCount(base);

    // 30초마다 최근 1시간 내 새 글 수 조회
    const fetchRecent = async () => {
      const sb = createSupabaseBrowser();
      const since = new Date(Date.now() - 3600000).toISOString();
      const { count } = await sb.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', since);
      setRecentPosts(count ?? 0);
    };
    fetchRecent();
    const timer = setInterval(() => {
      setOnlineCount(prev => Math.max(5, prev + Math.floor(Math.random() * 7) - 3));
      fetchRecent();
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  if (onlineCount <= 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'livePulse 2s infinite' }} />
        <span style={{ color: '#22C55E', fontWeight: 600 }}>{onlineCount}명</span> 접속 중
      </span>
      {recentPosts > 0 && (
        <>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span>최근 1시간 <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{recentPosts}</span>개 새 글</span>
        </>
      )}
      <style>{`@keyframes livePulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
