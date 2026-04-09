'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';

const MISSIONS = [
  { key: 'interest', label: '관심사 설정', icon: '🎯', reward: 50, link: '/onboarding' },
  { key: 'watchlist', label: '관심종목/단지 추가', icon: '⭐', reward: 50, link: '/stock' },
  { key: 'comment', label: '첫 댓글 달기', icon: '💬', reward: 30, link: '/feed' },
  { key: 'post', label: '첫 글 작성', icon: '✍️', reward: 100, link: '/write' },
];

export default function GlobalMissionBar() {
  const { userId, loading } = useAuth();
  const [mission, setMission] = useState<{ completed: boolean; progress: Record<string, boolean> } | null>(null);
  const [attended, setAttended] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!userId || loading) return;
    const sb = createSupabaseBrowser();
    (sb as any).from('profiles')
      .select('first_mission_completed, first_mission_progress, last_checked_date')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!data) return;
        if (!data.first_mission_completed) {
          setMission({ completed: false, progress: data.first_mission_progress || {} });
        }
        const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
        if (data.last_checked_date !== today) setAttended(false);
      });
  }, [userId, loading]);

  const handleAttend = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/attendance', { method: 'POST' });
      if (res.ok) setAttended(true);
    } catch {}
    setChecking(false);
  };

  if (loading || !userId) return null;

  // 출석 미완료 우선 표시
  if (!attended) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', marginBottom: 8, borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,123,246,0.06))',
        border: '1px solid rgba(16,185,129,0.15)', fontSize: 13,
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>📅 오늘 출석하고 <strong style={{ color: 'var(--brand)' }}>+10P</strong> 받기</span>
        <button onClick={handleAttend} disabled={checking} style={{
          padding: '4px 14px', borderRadius: 6, border: 'none',
          background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: checking ? 'not-allowed' : 'pointer', opacity: checking ? 0.6 : 1,
        }}>체크!</button>
      </div>
    );
  }

  // 첫 미션 미완료 표시
  if (mission && !mission.completed) {
    const done = Object.values(mission.progress).filter(Boolean).length;
    const total = MISSIONS.length;

    return (
      <div style={{
        marginBottom: 8, borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(59,123,246,0.06))',
        border: '1px solid rgba(251,191,36,0.15)', fontSize: 13, overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', cursor: 'pointer',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            🎯 첫 미션 <strong style={{ color: 'var(--brand)' }}>{done}/{total}</strong> 완료
            {done >= 2 ? ' → 보너스 수령 완료!' : ` → 2개 완료 시 +200P 보너스`}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{expanded ? '▲' : '▼'}</span>
        </div>

        {/* 미션 목록 (확장 시) */}
        {expanded && (
          <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* 프로그레스 바 */}
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(done / total) * 100}%`, background: 'var(--brand)', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>

            {MISSIONS.map(m => {
              const isDone = mission.progress[m.key];
              return (
                <Link
                  key={m.key}
                  href={isDone ? '#' : m.link}
                  onClick={e => isDone && e.preventDefault()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 6,
                    background: isDone ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isDone ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)'}`,
                    textDecoration: 'none', color: 'inherit',
                    opacity: isDone ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {isDone ? '✅' : m.icon} {m.label}
                  </span>
                  <span style={{ fontSize: 12, color: isDone ? '#22c55e' : 'var(--brand)', fontWeight: 600 }}>
                    {isDone ? '완료' : `+${m.reward}P`}
                  </span>
                </Link>
              );
            })}

            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 2 }}>
              2개 이상 완료 시 보너스 +200P 추가 지급!
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
