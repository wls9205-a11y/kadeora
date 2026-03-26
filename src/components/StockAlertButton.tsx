'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import BottomSheet from '@/components/BottomSheet';
import { useToast } from '@/components/Toast';

export default function StockAlertButton({ symbol, stockName, currentPrice, currency }: { symbol: string; stockName: string; currentPrice: number; currency?: string }) {
  const [open, setOpen] = useState(false);
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [threshold, setThreshold] = useState('');
  const [myAlerts, setMyAlerts] = useState<any[]>([]);
  const { userId } = useAuth();
  const [saving, setSaving] = useState(false);
  const { info } = useToast();

  useEffect(() => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    sb.from('price_alerts')
      .select('id, alert_type, condition, threshold, is_triggered')
      .eq('user_id', userId)
      .eq('target_symbol', symbol)
      .eq('is_active', true)
      .then(({ data: alerts }) => setMyAlerts(alerts || []));
  }, [symbol, userId]);

  const addAlert = async () => {
    if (!userId || !threshold || saving) return;
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      await (sb.from('price_alerts') as any).insert({
        user_id: userId, alert_type: 'stock_price', condition: alertType,
        threshold: Number(threshold), target_symbol: symbol, is_active: true, is_triggered: false,
      });
      const { data: alerts } = await sb.from('price_alerts')
        .select('id, alert_type, condition, threshold, is_triggered')
        .eq('user_id', userId).eq('target_symbol', symbol).eq('is_active', true);
      setMyAlerts(alerts || []);
      setThreshold('');
      setOpen(false);
    } catch {}
    setSaving(false);
  };

  const deleteAlert = async (id: string) => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    await sb.from('price_alerts').delete().eq('id', id).eq('user_id', userId);
    setMyAlerts(prev => prev.filter(a => a.id !== id));
  };

  const isKR = currency !== 'USD';
  const fmtPrice = (p: number) => isKR ? `₩${p.toLocaleString()}` : `$${p.toFixed(2)}`;

  return (
    <div>
      <button onClick={() => { if (!userId) { info('로그인하면 알림을 설정할 수 있어요'); return; } setOpen(!open); }} style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
        background: myAlerts.length > 0 ? 'rgba(251,191,36,0.1)' : 'var(--bg-hover)',
        border: myAlerts.length > 0 ? '1px solid rgba(251,191,36,0.3)' : '1px solid var(--border)',
        color: myAlerts.length > 0 ? 'var(--accent-yellow)' : 'var(--text-secondary)',
        fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer',
      }}>
        🔔 알림 {myAlerts.length > 0 ? `(${myAlerts.length})` : '설정'}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={`🔔 ${stockName} 알림`} maxWidth={480}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 16, marginTop: -8 }}>현재가 {fmtPrice(currentPrice)}</div>
        {myAlerts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>활성 알림</div>
            {myAlerts.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: a.is_triggered ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                  {a.condition === 'above' ? '📈 이상' : '📉 이하'} {fmtPrice(a.threshold)}
                  {a.is_triggered && ' ✅ 도달'}
                </span>
                <button onClick={() => deleteAlert(a.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>삭제</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>새 알림 추가</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[{ key: 'above' as const, label: '📈 이상 도달' }, { key: 'below' as const, label: '📉 이하 도달' }].map(t => (
            <button key={t.key} onClick={() => setAlertType(t.key)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 600,
              background: alertType === t.key ? 'var(--brand)' : 'var(--bg-hover)',
              color: alertType === t.key ? 'var(--text-inverse)' : 'var(--text-secondary)',
              border: alertType === t.key ? 'none' : '1px solid var(--border)', cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
            placeholder={`목표가 (현재 ${fmtPrice(currentPrice)})`} aria-label="목표가 입력"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none' }} />
          <button onClick={addAlert} disabled={saving || !threshold} style={{
            padding: '10px 20px', borderRadius: 8, background: 'var(--brand)', color: 'var(--text-inverse)',
            fontSize: 'var(--fs-sm)', fontWeight: 700, border: 'none', cursor: 'pointer',
            opacity: saving || !threshold ? 0.5 : 1,
          }}>{saving ? '...' : '추가'}</button>
        </div>
      </BottomSheet>
    </div>
  );
}
