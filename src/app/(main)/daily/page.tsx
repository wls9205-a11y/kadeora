'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function DailyRedirect() {
  const router = useRouter();
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();

      // 1. 로그인 유저 → DB 지역 우선
      if (user) {
        const { data: profile } = await sb.from('profiles')
          .select('residence_city').eq('id', user.id).maybeSingle();
        if (profile?.residence_city) {
          // DB 지역 있으면 → localStorage도 동기화
          localStorage.setItem('daily_region', profile.residence_city);
          router.replace(`/daily/${encodeURIComponent(profile.residence_city)}`);
          return;
        }
        // DB 지역 없으면 → RegionBottomSheet 표시
        setShowRegionPicker(true);
        return;
      }

      // 2. 비로그인 → localStorage → 기본값 '서울'
      const saved = localStorage.getItem('daily_region');
      router.replace(`/daily/${encodeURIComponent(saved || '서울')}`);
    })();
  }, [router]);

  if (showRegionPicker) {
    return <DailyRegionPicker onSelect={(city: string) => {
      localStorage.setItem('daily_region', city);
      router.replace(`/daily/${encodeURIComponent(city)}`);
    }} />;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-tertiary)', fontSize: 14 }}>
      리포트 로딩 중...
    </div>
  );
}

/* ── 인라인 지역 선택기 (RegionBottomSheet 대신 간단 버전) ── */
const REGIONS = ['서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];

function DailyRegionPicker({ onSelect }: { onSelect: (city: string) => void }) {
  const saveToDB = async (city: string) => {
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        await sb.from('profiles').update({
          residence_city: city,
          region_text: city,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      }
    } catch {}
    onSelect(city);
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
        어디에 사세요?
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        내 지역 맞춤 부동산·경제 리포트를 받아보세요
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {REGIONS.map(r => (
          <button key={r} onClick={() => saveToDB(r)} style={{
            padding: '12px 0', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}>
            {r}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
        설정 후 언제든 변경할 수 있어요
      </div>
    </div>
  );
}
