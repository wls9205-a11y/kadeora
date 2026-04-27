'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';

// s188: 댓글 미션 동선 — 피드보다 블로그가 댓글 진입 자연스러움. 글쓰기는 /write 유지.
const MISSIONS = [
  { key: 'interest', label: '관심 단지 등록', icon: '🏠', reward: 50, link: '/apt' },
  { key: 'watchlist', label: '관심 종목 등록', icon: '📈', reward: 50, link: '/stock' },
  { key: 'comment', label: '첫 댓글 달기', icon: '💬', reward: 30, link: '/blog' },
  { key: 'post', label: '첫 글 작성', icon: '✍️', reward: 100, link: '/write' },
];

export default function GlobalMissionBar() {
  const { userId, loading } = useAuth();
  const [mission, setMission] = useState<{ completed: boolean; progress: Record<string, boolean> } | null>(null);
  const [attended, setAttended] = useState(true);
  // s188: done < 2 면 기본 펼침 — 14/638 (2.2%) 완료율의 직접 원인은 collapsed 기본값.
  const [expanded, setExpanded] = useState(true);
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
        padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,123,246,0.06))',
        border: '1px solid rgba(16,185,129,0.15)', fontSize: 13,
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>📅 오늘 출석하고 <strong style={{ color: 'var(--brand)' }}>+10P</strong> 받기</span>
        <button onClick={handleAttend} disabled={checking} style={{
          padding: '4px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
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
        marginBottom: 8, borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(59,123,246,0.06))',
        border: '1px solid rgba(251,191,36,0.15)', fontSize: 13, overflow: 'hidden',
      }}>
        {/* 헤더 — s188: 진행도 도트 추가 (collapsed 시에도 시각적 피드백) */}
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', cursor: 'pointer', gap: 10,
          }}
        >
          <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ whiteSpace: 'nowrap' }}>🎯 첫 미션</span>
            <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {MISSIONS.map(m => (
                <span key={m.key} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: mission.progress[m.key] ? '#22c55e' : 'rgba(255,255,255,0.12)',
                  border: mission.progress[m.key] ? 'none' : '1px solid var(--border)',
                }} />
              ))}
            </span>
            <strong style={{ color: 'var(--brand)' }}>{done}/{total}</strong>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {done >= 2 ? '보너스 수령 완료!' : '2개 완료 시 +200P'}
            </span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
        </div>

        {/* 미션 목록 (확장 시) */}
        {expanded && (
          <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* 프로그레스 바 */}
            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(done / total) * 100}%`, background: 'var(--brand)', borderRadius: 4, transition: 'width 0.3s' }} />
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
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
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
