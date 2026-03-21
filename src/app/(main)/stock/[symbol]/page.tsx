// Cache: 300s — 주식 상세 (시세 크론 5분 주기)
export const revalidate = 300;

import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import MiniDiscuss from '@/components/MiniDiscuss';
import StockComments from '@/components/StockComments';
import ShareButtons from '@/components/ShareButtons';

function fmtPrice(p: number, c: string) { return c === 'KRW' ? `₩${p.toLocaleString()}` : `$${p.toFixed(2)}`; }
function fmtCap(v: number | null, c: string) {
  if (!v) return '-';
  if (c === 'USD') { if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`; if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`; return `$${(v/1e6).toFixed(0)}M`; }
  if (v >= 1e12) return `${(v/1e12).toFixed(1)}조`; if (v >= 1e8) return `${Math.round(v/1e8)}억`; return v.toLocaleString();
}

interface Props { params: Promise<{ symbol: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await sb.from('stock_quotes').select('name,market,price,currency,change_pct').eq('symbol', symbol).single();
  if (!s) return { title: '카더라' };
  const p = fmtPrice(Number(s.price), s.currency);
  const ch = `${Number(s.change_pct) >= 0 ? '▲' : '▼'}${Math.abs(Number(s.change_pct)).toFixed(2)}%`;
  return {
    title: `${s.name} (${symbol}) 주가 | 카더라`,
    description: `${s.name} 현재가 ${p} ${ch}. ${s.market} 상장.`,
    alternates: {
      canonical: `https://kadeora.app/stock/${symbol}`,
    },
    openGraph: { title: `${s.name} 주가`, description: `${s.market} · ${p} · ${ch}`, images: [{ url: 'https://kadeora.app/images/brand/kadeora-wide.png' }] },
  };
}

export default async function StockDetailPage({ params }: Props) {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await sb.from('stock_quotes').select('*').eq('symbol', symbol).single();
  if (!s) notFound();

  const changePct = Number(s.change_pct);
  const isUp = changePct > 0;
  const isDown = changePct < 0;
  const isStale = !s.updated_at || s.updated_at.startsWith('2000-01-01');
  const items = [
    { label: '시가총액', value: fmtCap(s.market_cap ? Number(s.market_cap) : null, s.currency) },
    { label: '거래량', value: s.volume ? Number(s.volume).toLocaleString() : '-' },
    { label: '통화', value: s.currency },
    { label: '업데이트', value: s.updated_at ? new Date(s.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-' },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link href="/stock" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: 20, display: 'inline-block' }}>← 주식 시세</Link>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>{s.name}</h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 12, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '3px 10px', borderRadius: 6 }}>{symbol}</span>
          <span style={{ fontSize: 12, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '3px 10px', borderRadius: 6 }}>{s.market}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-primary)' }}>{fmtPrice(Number(s.price), s.currency)}</span>
        </div>
        {isStale ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>⏳ 시세 정보 준비 중입니다</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <span style={{
              fontSize: 20, fontWeight: 700,
              color: isUp ? '#ef4444' : isDown ? '#3b82f6' : 'var(--text-tertiary)',
            }}>
              {isUp ? '▲' : isDown ? '▼' : '━'} {isUp ? '+' : ''}{Number(s.change_amt).toLocaleString()} ({Math.abs(changePct).toFixed(2)}%)
            </span>
            {s.updated_at && !s.updated_at.startsWith('2000-01-01') && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {new Date(s.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>
      {/* AI 한줄평 */}
      {await (async () => {
        const { data: aiComment } = await sb.from('stock_ai_comments')
          .select('*').eq('symbol', symbol).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!aiComment) return null;
        const signalColor = aiComment.signal === 'bullish' ? '#16a34a' : aiComment.signal === 'bearish' ? '#ef4444' : 'var(--text-tertiary)';
        const signalLabel = aiComment.signal === 'bullish' ? '🟢 매수 우위' : aiComment.signal === 'bearish' ? '🔴 매도 우위' : '🟡 중립';
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🤖 AI 한줄평</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: signalColor }}>{signalLabel}</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{aiComment.content}</p>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
              {new Date(aiComment.created_at).toLocaleDateString('ko-KR')} 기준 · AI 분석은 참고용이며 투자 판단의 근거가 될 수 없습니다
            </div>
          </div>
        );
      })()}

      <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>🏢 회사 소개</div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          {s.description ?? `${s.name}은(는) ${s.market} 상장 종목입니다. 자세한 기업 정보는 공식 홈페이지나 증권사 앱에서 확인해보세요.`}
        </p>
      </div>
      <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        ⚠️ 본 정보는 투자 권유가 아니며, 투자에 따른 손익은 투자자 본인에게 귀속됩니다. 금융투자상품은 원금 손실이 발생할 수 있습니다.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>공유</span>
        <ShareButtons title={`${s.name} (${symbol}) 주가`} postId={symbol} />
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <StockComments symbol={symbol} stockName={s.name} />
      </div>
      <Link href="/discuss" style={{ display: 'block', textAlign: 'center', padding: 14, background: 'var(--brand)', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 700, color: 'var(--text-inverse)' }}>
        💬 라운지 입장
      </Link>
    </div>
  );
}
