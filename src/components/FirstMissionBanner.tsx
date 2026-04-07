'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

interface MissionProgress {
  watchlist: boolean;
  interest: boolean;
  post: boolean;
  comment: boolean;
}

const MISSIONS = [
  { key: 'watchlist', label: '관심 종목 등록', points: 50, href: '/stock', icon: '📈' },
  { key: 'interest', label: '관심 현장 등록', points: 50, href: '/apt', icon: '🏠' },
  { key: 'post', label: '첫 게시글 작성', points: 100, href: '/write', icon: '📝' },
  { key: 'comment', label: '첫 댓글 남기기', points: 30, href: '/feed', icon: '💬' },
] as const;

export default function FirstMissionBanner() {
  const { userId } = useAuth();
  const [progress, setProgress] = useState<MissionProgress | null>(null);
  const [completed, setCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (sessionStorage.getItem('kd_mission_dismissed')) { setDismissed(true); return; }
    fetch('/api/profile/mission').then(r => r.json()).then(d => {
      if (d.first_mission_completed) { setCompleted(true); return; }
      setProgress(d.progress || { watchlist: false, interest: false, post: false, comment: false });
    }).catch(() => {});
  }, [userId]);

  if (!userId || completed || dismissed || !progress) return null;

  const done = Object.values(progress).filter(Boolean).length;
  const total = MISSIONS.length;
  const allDone = done >= 2; // 2개 이상 완료 시 보너스

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(16,185,129,0.08))',
      border: '1px solid rgba(59,123,246,0.15)',
      borderRadius: 'var(--radius-card, 12px)',
      padding: '14px 16px',
      margin: '8px 0 12px',
      position: 'relative',
    }}>
      <button onClick={() => { setDismissed(true); sessionStorage.setItem('kd_mission_dismissed', '1'); }}
        style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 14, cursor: 'pointer' }}>×</button>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        🎯 첫 미션 ({done}/{total})
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
        미션을 완료하고 포인트를 받아가세요! 2개 이상 완료 시 보너스 200P
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {MISSIONS.map(m => (
          <Link key={m.key} href={m.href} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 8,
            background: progress[m.key as keyof MissionProgress]
              ? 'rgba(16,185,129,0.1)' : 'var(--bg-surface)',
            border: `1px solid ${progress[m.key as keyof MissionProgress] ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
            textDecoration: 'none', fontSize: 11,
            opacity: progress[m.key as keyof MissionProgress] ? 0.6 : 1,
          }}>
            <span style={{ fontSize: 14 }}>{progress[m.key as keyof MissionProgress] ? '✅' : m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.label}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>+{m.points}P</div>
            </div>
          </Link>
        ))}
      </div>
      {allDone && (
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11, color: '#10B981', fontWeight: 600, textAlign: 'center' }}>
          🎉 보너스 200P 지급 완료!
        </div>
      )}
    </div>
  );
}
