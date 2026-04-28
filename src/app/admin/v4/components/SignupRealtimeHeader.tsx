'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface HeaderData {
  seed_total?: number;
  real_total?: number;
  real_today?: number;
  real_24h?: number;
  real_5min?: number;
  active_5min?: number;
  active_today?: number;
  signup_attempts_today?: number;
  provider_kakao?: number;
  provider_google?: number;
  kakao_added?: number;
}

interface Tile {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'red' | 'green' | 'orange' | 'default';
  href?: string;
}

const TONE: Record<NonNullable<Tile['tone']>, { color: string; bg: string }> = {
  red:     { color: 'var(--accent-red, #f87171)',    bg: 'rgba(248,113,113,0.06)' },
  green:   { color: 'var(--accent-green, #34d399)',  bg: 'rgba(52,211,153,0.06)'  },
  orange:  { color: 'var(--accent-orange, #fb923c)', bg: 'rgba(251,146,60,0.06)'  },
  default: { color: 'var(--text-primary, #fff)',     bg: 'transparent'             },
};

export default function SignupRealtimeHeader() {
  const [data, setData] = useState<HeaderData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetch('/api/admin/v4/header', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j?.ok) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 60_000);
    document.addEventListener('visibilitychange', fetchData);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', fetchData);
    };
  }, [fetchData]);

  const d = data ?? {};
  const kakaoPct = (d.real_total && d.kakao_added != null)
    ? Math.round((d.kakao_added / Math.max(1, d.real_total)) * 1000) / 10
    : 0;

  const tiles: Tile[] = [
    { label: '시드', value: (d.seed_total ?? 0).toLocaleString(), sub: 'is_seed=true', href: '/admin/users?filter=seed' },
    {
      label: '진짜',
      value: (d.real_total ?? 0).toLocaleString(),
      sub: <span>kakao {d.provider_kakao ?? 0} · google {d.provider_google ?? 0}</span>,
      tone: 'green',
      href: '/admin/users?filter=real',
    },
    {
      label: '오늘 신규',
      value: d.real_today ?? 0,
      sub: `시도 ${d.signup_attempts_today ?? 0}`,
      tone: (d.real_today ?? 0) === 0 ? 'red' : 'green',
      href: '/admin/users?filter=real&sort=created_desc',
    },
    {
      label: '5분 실시간',
      value: d.real_5min ?? 0,
      sub: `active ${d.active_5min ?? 0}`,
      tone: (d.real_5min ?? 0) > 0 ? 'green' : 'default',
    },
    {
      label: '카카오 채널',
      value: `${kakaoPct}%`,
      sub: `${d.kakao_added ?? 0}/${d.real_total ?? 0}`,
      tone: kakaoPct >= 30 ? 'green' : kakaoPct >= 10 ? 'orange' : 'red',
      href: '/admin/users?filter=kakao_channel',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 8,
      padding: 10,
      borderRadius: 'var(--radius-md, 10px)',
      background: 'var(--bg-elevated, #1f2028)',
      border: '1px solid var(--border, #2a2b35)',
      opacity: loading && !data ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      {tiles.map((t, i) => {
        const tone = TONE[t.tone ?? 'default'];
        const card = (
          <div key={i} style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: tone.bg,
            border: '1px solid var(--border, #2a2b35)',
            cursor: t.href ? 'pointer' : 'default',
            transition: 'transform 0.1s',
            display: 'flex', flexDirection: 'column', gap: 2,
            minWidth: 0,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary, #888)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {t.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: tone.color, lineHeight: 1.1 }}>
              {t.value}
            </div>
            {t.sub != null && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.sub}
              </div>
            )}
          </div>
        );
        return t.href ? <Link key={i} href={t.href} style={{ textDecoration: 'none' }}>{card}</Link> : card;
      })}
    </div>
  );
}
