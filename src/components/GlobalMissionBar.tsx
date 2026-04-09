'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';

export default function GlobalMissionBar() {
  const { userId, loading } = useAuth();
  const [mission, setMission] = useState<{ completed: boolean; progress: Record<string, boolean> } | null>(null);
  const [attended, setAttended] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!userId || loading) return;
    const sb = createSupabaseBrowser();
    (sb as any).from('profiles')
      .select('first_mission_completed, first_mission_progress, last_checked_date')
      .eq('id', userId)
      .single()
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

  if (loading || !userId || dismissed) return null;

  // 출석 미완료 우선 표시
  if (!attended) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', marginBottom: 8, borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,123,246,0.06))',
        border: '1px solid rgba(16,185,129,0.15)',
        fontSize: 13,
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>📅 오늘 출석하고 <strong style={{ color: 'var(--brand)' }}>+10P</strong> 받기</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleAttend} disabled={checking} style={{
            padding: '4px 14px', borderRadius: 6, border: 'none',
            background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: checking ? 'not-allowed' : 'pointer', opacity: checking ? 0.6 : 1,
          }}>체크!</button>
          <button onClick={() => setDismissed(true)} style={{
            padding: '4px 8px', borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer',
          }}>✕</button>
        </div>
      </div>
    );
  }

  // 첫 미션 미완료 표시
  if (mission && !mission.completed) {
    const done = Object.values(mission.progress).filter(Boolean).length;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', marginBottom: 8, borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(59,123,246,0.06))',
        border: '1px solid rgba(251,191,36,0.15)',
        fontSize: 13,
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>🎯 첫 미션 {done}/2 완료 → <strong style={{ color: 'var(--brand)' }}>+200P 보너스</strong></span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/feed" style={{
            padding: '4px 14px', borderRadius: 6, border: 'none',
            background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700,
            textDecoration: 'none',
          }}>미션 보기</Link>
          <button onClick={() => setDismissed(true)} style={{
            padding: '4px 8px', borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer',
          }}>✕</button>
        </div>
      </div>
    );
  }

  return null;
}
