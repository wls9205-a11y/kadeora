'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';

const STREAK_REWARDS = [
  { days: 3, bonus: 15, label: '3일 연속' },
  { days: 7, bonus: 50, label: '7일 연속' },
  { days: 14, bonus: 80, label: '14일 연속' },
  { days: 30, bonus: 150, label: '30일 연속' },
];

export default function AttendancePage() {
  const [data, setData] = useState<{ streak: number; total_days: number; already_today: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [reward, setReward] = useState<{ points: number; bonus: string | null } | null>(null);
  const { success, error } = useToast();

  useEffect(() => {
    fetch('/api/attendance').then(r => r.json()).then(d => {
      if (d.error) { setLoading(false); return; }
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/attendance', { method: 'POST' });
      const d = await res.json();
      if (d.already) { success('오늘 이미 출석했어요!'); }
      else if (d.error) { error(d.error); }
      else {
        setReward({ points: d.points_earned, bonus: d.bonus });
        setData({ streak: d.streak, total_days: d.total_days, already_today: true });
        success(`출석 완료! +${d.points_earned}P`);
      }
    } catch { error('출석 체크 실패'); }
    setChecking(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>로딩 중...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>로그인이 필요합니다</div>;

  const nextReward = STREAK_REWARDS.find(r => r.days > data.streak);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px', color: 'var(--text-primary)' }}>출석 체크</h1>

      {/* 스트릭 카드 */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24, textAlign: 'center', marginBottom: 16,
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🔥</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--brand)' }}>{data.streak}일</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>연속 출석</div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{data.total_days}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>총 출석일</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>+10P</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>기본 보상</div>
          </div>
        </div>

        {data.already_today ? (
          <div style={{
            padding: '14px 0', borderRadius: 'var(--radius-card)',
            background: 'var(--bg-hover)', color: 'var(--text-secondary)',
            fontSize: 14, fontWeight: 700,
          }}>
            ✅ 오늘 출석 완료!
          </div>
        ) : (
          <button onClick={handleCheck} disabled={checking} style={{
            width: '100%', padding: '14px 0', borderRadius: 'var(--radius-card)',
            border: 'none', background: 'var(--brand)', color: '#fff',
            fontSize: 15, fontWeight: 800, cursor: checking ? 'not-allowed' : 'pointer',
            opacity: checking ? 0.6 : 1,
          }}>
            {checking ? '출석 중...' : '출석 체크하기 🌱'}
          </button>
        )}

        {reward && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 'var(--radius-md)',
            background: 'rgba(16,185,129,0.1)', color: '#10B981', fontSize: 13, fontWeight: 600,
          }}>
            🎉 +{reward.points}P {reward.bonus && `(${reward.bonus})`}
          </div>
        )}
      </div>

      {/* 연속 보상 안내 */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
          연속 출석 보너스
        </div>
        {STREAK_REWARDS.map(r => {
          const done = data.streak >= r.days;
          const current = data.streak < r.days && (!nextReward || nextReward.days === r.days);
          return (
            <div key={r.days} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                background: done ? 'rgba(16,185,129,0.15)' : current ? 'rgba(59,123,246,0.15)' : 'var(--bg-hover)',
                color: done ? '#10B981' : current ? 'var(--brand)' : 'var(--text-tertiary)',
              }}>
                {done ? '✓' : r.days}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: done ? '#10B981' : 'var(--text-primary)' }}>{r.label}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: done ? '#10B981' : 'var(--brand)' }}>+{r.bonus}P</div>
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
          매일 +10P 기본 보상 + 연속 보너스
        </div>
      </div>
    </div>
  );
}
