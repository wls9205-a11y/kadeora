'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type ActionItem = {
  severity: 'red' | 'yellow' | 'green';
  key: string;
  message: string;
  action: string;
};

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  red:    { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)',  color: '#fca5a5', icon: '🚨' },
  yellow: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)', color: '#fbbf24', icon: '⚠️' },
  green:  { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)',  color: '#4ade80', icon: '✅' },
};

export default function AdminActionItemsCard() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data, error } = await (sb as any)
          .from('v_admin_action_items_v2')
          .select('severity, key, message, action');
        if (cancelled) return;
        if (!error && data) setItems(data as ActionItem[]);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>액션 시그널 로드 중...</div>;
  if (!items.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
        🎯 액션 시그널 ({items.length}건)
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item) => {
          const style = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.yellow;
          return (
            <div key={item.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 16px', borderRadius: 10,
              background: style.bg, border: `1px solid ${style.border}`,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{style.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: style.color, marginBottom: 4 }}>
                  {item.message}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  → {item.action}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
