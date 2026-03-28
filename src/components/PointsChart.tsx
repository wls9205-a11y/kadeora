'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function PointsChart() {
  const [history, setHistory] = useState<{ date: string; amount: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const uid = session.user.id;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await sb.from('point_history')
        .select('amount, created_at')
        .eq('user_id', uid)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true });

      if (!data?.length) return;

      // Group by date
      const byDate: Record<string, number> = {};
      data.forEach((d: any) => {
        const date = new Date(d.created_at).toISOString().slice(0, 10);
        byDate[date] = (byDate[date] || 0) + (d.amount || 0);
      });
      const entries = Object.entries(byDate).map(([date, amount]) => ({ date, amount }));
      setHistory(entries);
      setTotal(data.reduce((s: number, d: any) => s + (d.amount || 0), 0));

      const thisMonth = new Date().toISOString().slice(0, 7);
      setMonthTotal(data.filter((d: any) => d.created_at.startsWith(thisMonth)).reduce((s: number, d: any) => s + (d.amount || 0), 0));
    });
  }, []);

  if (history.length === 0) return null;
  const maxAmt = Math.max(...history.map(h => h.amount), 1);

  return (
    <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>🎁 포인트 획득 추이</span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>이번 달 +{monthTotal}P</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
        {history.map((h, i) => (
          <div key={i} title={`${h.date}: +${h.amount}P`} style={{
            flex: 1, minWidth: 3, borderRadius: '2px 2px 0 0',
            height: `${(h.amount / maxAmt) * 100}%`,
            background: 'var(--brand)', opacity: 0.7,
          }} />
        ))}
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>
        최근 30일 누적 +{total}P
      </div>
    </div>
  );
}
