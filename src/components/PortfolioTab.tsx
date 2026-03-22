'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { SkeletonList } from '@/components/Skeleton';
import EmptyState from '@/components/shared/EmptyState';

interface Holding {
  id: string; symbol: string; buy_price: number; quantity: number;
  current_price: number; name: string; currency?: string;
  pnl: number; pnl_pct: number; memo?: string;
}
interface Summary { totalInvested: number; totalCurrent: number; totalPnl: number; pnlPct: number; }

function fmt(n: number, cur?: string) {
  if (cur === 'USD') return `$${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `₩${n.toLocaleString('ko-KR')}`;
}

export default function PortfolioTab() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalInvested: 0, totalCurrent: 0, totalPnl: 0, pnlPct: 0 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', buy_price: '', quantity: '', memo: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHoldings(data.holdings || []);
      setSummary(data.summary || { totalInvested: 0, totalCurrent: 0, totalPnl: 0, pnlPct: 0 });
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.symbol || !form.buy_price || !form.quantity) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ symbol: '', buy_price: '', quantity: '', memo: '' });
        setShowAdd(false);
        load();
      }
    } catch { }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <SkeletonList count={3} type="stock" />;

  const pnlColor = summary.totalPnl >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)';

  return (
    <div>
      {/* 요약 카드 */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16, marginBottom: 12,
      }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>총 평가 손익</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: pnlColor }}>
            {summary.totalPnl >= 0 ? '+' : ''}{summary.totalPnl.toLocaleString('ko-KR')}원
          </span>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: pnlColor }}>
            ({summary.pnlPct >= 0 ? '+' : ''}{summary.pnlPct.toFixed(2)}%)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>투자금액</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{summary.totalInvested.toLocaleString('ko-KR')}원</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평가금액</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{summary.totalCurrent.toLocaleString('ko-KR')}원</div>
          </div>
        </div>
      </div>

      {/* 추가 버튼 */}
      <button onClick={() => setShowAdd(!showAdd)} style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 14px',
        background: showAdd ? 'var(--bg-hover)' : 'var(--bg-surface)',
        border: '1px dashed var(--border)', borderRadius: 10, cursor: 'pointer',
        color: 'var(--brand)', fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 12,
      }}>
        <Plus size={16} /> 종목 추가
      </button>

      {/* 추가 폼 */}
      {showAdd && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 14, marginBottom: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input placeholder="종목코드 (예: 005930)" value={form.symbol}
              onChange={e => setForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
            <input placeholder="매수가" type="number" value={form.buy_price}
              onChange={e => setForm(p => ({ ...p, buy_price: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
            <input placeholder="수량" type="number" value={form.quantity}
              onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
            <input placeholder="메모 (선택)" value={form.memo}
              onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
          </div>
          <button onClick={handleAdd} disabled={submitting} style={{
            width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)',
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? '추가 중...' : '추가하기'}
          </button>
        </div>
      )}

      {/* 보유 종목 리스트 */}
      {holdings.length === 0 ? (
        <EmptyState icon="💰" title="등록된 종목이 없습니다" description="종목을 추가해서 수익률을 추적해보세요!" actionLabel="종목 추가" actionHref="#" />
      ) : (
        holdings.map(h => {
          const isProfit = h.pnl >= 0;
          const color = isProfit ? 'var(--accent-red)' : 'var(--accent-blue)';
          return (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, marginBottom: 6,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isProfit ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
              }}>
                {isProfit ? <TrendingUp size={18} color={color} /> : <TrendingDown size={18} color={color} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{h.name || h.symbol}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  {h.quantity}주 · 평단 {fmt(h.buy_price, h.currency)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color }}>
                  {isProfit ? '+' : ''}{h.pnl_pct?.toFixed(2)}%
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  {fmt(h.current_price, h.currency)}
                </div>
              </div>
              <button onClick={() => handleDelete(h.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                padding: 4, flexShrink: 0,
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
