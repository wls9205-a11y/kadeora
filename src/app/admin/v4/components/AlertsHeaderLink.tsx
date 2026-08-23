'use client';

// [S10-2] 헤더의 경보함 링크. 배지 숫자는 '살아있는 critical급' 건수다.
//
// 폴링하지 않는다 — v_admin_dashboard_v4 가 1회 1,521ms 짜리라 헤더에서 도는 주기 요청을
// 하나 더 늘리면 S10-5(폴링 완화)와 정면으로 부딪힌다. 마운트 시 1회 + 탭 복귀 시 1회면 충분하다.

import { useCallback, useEffect, useState } from 'react';

export default function AlertsHeaderLink() {
  const [critical, setCritical] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      // limit=1 — 행은 필요 없고 집계만 쓴다.
      const res = await fetch('/api/admin/alerts?archived=0&limit=1', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      setCritical(j?.live_by_severity?.critical ?? null);
    } catch { /* 헤더 배지라 조용히 무시 — 링크 자체는 계속 동작한다 */ }
  }, []);

  useEffect(() => {
    load();
    document.addEventListener('visibilitychange', load);
    return () => document.removeEventListener('visibilitychange', load);
  }, [load]);

  const hot = (critical ?? 0) > 0;

  return (
    <a
      href="/admin/alerts"
      style={{
        fontSize: 11, fontWeight: 700,
        padding: '6px 12px', borderRadius: 6,
        background: hot ? 'var(--accent-red-bg)' : 'transparent',
        color: hot ? 'var(--accent-red)' : 'var(--text-secondary)',
        border: `1px solid ${hot ? 'var(--accent-red)' : 'var(--border)'}`,
        textDecoration: 'none', whiteSpace: 'nowrap',
      }}
    >
      🔔 경보함{critical !== null ? ` (${critical})` : ''}
    </a>
  );
}
