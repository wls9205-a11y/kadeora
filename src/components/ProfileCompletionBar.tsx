'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface ProfileData {
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  age_group: string | null;
  region_text: string | null;
  profile_completed: boolean;
  profile_completion_rewarded: boolean;
}

const STEPS = [
  { key: 'nickname', label: '닉네임', check: (p: ProfileData) => !!p.nickname },
  { key: 'region', label: '지역 설정', check: (p: ProfileData) => !!p.region_text },
  { key: 'age', label: '연령대', check: (p: ProfileData) => !!p.age_group },
  { key: 'bio', label: '자기소개', check: (p: ProfileData) => !!p.bio && p.bio.length > 5 },
  { key: 'avatar', label: '프로필 사진', check: (p: ProfileData) => !!p.avatar_url },
];

export default function ProfileCompletionBar() {
  const { userId } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [rewarded, setRewarded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch('/api/profile/completion').then(r => r.json()).then(d => {
      if (d.profile) setProfile(d.profile);
      if (d.rewarded) setRewarded(true);
    }).catch(() => {});
  }, [userId]);

  if (!userId || !profile || profile.profile_completed) return null;

  const done = STEPS.filter(s => s.check(profile)).length;
  const pct = Math.round((done / STEPS.length) * 100);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card, 12px)',
      padding: '12px 14px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>프로필 완성도 {pct}%</span>
        <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>자기소개 작성하면 +200P 🎁</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10B981' : '#3B82F6', borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {STEPS.map(s => (
          <span key={s.key} style={{
            padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
            background: s.check(profile) ? 'rgba(16,185,129,0.1)' : 'var(--bg-hover)',
            color: s.check(profile) ? '#10B981' : 'var(--text-tertiary)',
            border: `1px solid ${s.check(profile) ? 'rgba(16,185,129,0.2)' : 'transparent'}`,
          }}>
            {s.check(profile) ? '✓' : '→'} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
