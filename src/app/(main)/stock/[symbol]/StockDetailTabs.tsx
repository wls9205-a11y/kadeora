'use client';
import { useState } from 'react';
import StockComments from '@/components/StockComments';
import CandlestickChart from '@/components/charts/CandlestickChart';

const GRADE_EMOJI: Record<number, string> = {1:'🌱',2:'🌿',3:'🍀',4:'🌸',5:'🌻',6:'⭐',7:'🔥',8:'💎',9:'👑',10:'🚀'};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface Props {
  symbol: string;
  stockName: string;
  aiComment: any;
  priceHistory: any[];
  news: any[];
  investorFlow: any[];
  disclosures: any[];
  description: string;
  currency: string;
}

function MiniChart({ data }: { data: { date: string; close_price: number }[] }) {
  if (!data || data.length < 2) return null;
  const prices = data.map(d => Number(d.close_price));
  const min = Math.min(...prices); const max = Math.max(...prices);
  const range = max - min || 1; const W = 300; const H = 80; const P = 4;
  const points = prices.map((p, i) => `${P + (i / (prices.length - 1)) * (W - P * 2)},${H - P - ((p - min) / range) * (H - P * 2)}`).join(' ');
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? '#ef4444' : '#3b82f6';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>📈 1개월 추이</span>
        <span style={{ color, fontWeight: 700 }}>{isUp ? '▲' : '▼'} {((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(1)}%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
        <span>{data[0].date.slice(5)}</span>
        <span>{data[data.length - 1].date.slice(5)}</span>
      </div>
      {/* 52주 범위 */}
      {prices.length > 5 && (() => {
        const low = Math.min(...prices); const high = Math.max(...prices);
        const current = prices[prices.length - 1];
        const pos = high > low ? ((current - low) / (high - low)) * 100 : 50;
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>가격 범위</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{low.toLocaleString()}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-hover)', borderRadius: 3, position: 'relative' }}>
                <div style={{ position: 'absolute', left: `calc(${pos}% - 5px)`, top: -2, width: 10, height: 10, borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--bg-surface)' }} />
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{high.toLocaleString()}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const TABS = [
  { key: 'overview', label: '개요' },
  { key: 'chart', label: '차트' },
  { key: 'flow', label: '수급' },
  { key: 'news', label: '뉴스' },
  { key: 'disclosure', label: '공시' },
  { key: 'discuss', label: '토론' },
];

export default function StockDetailTabs({ symbol, stockName, aiComment, priceHistory, news, investorFlow, disclosures, description, currency }: Props) {
  const [tab, setTab] = useState('overview');

  return (
    <div>
      {/* 탭 */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600, background: 'transparent',
            color: tab === t.key ? 'var(--brand)' : 'var(--text-tertiary)',
            borderBottom: tab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
            flexShrink: 0,
          }}>{t.label}</button>
        ))}
      </div>

      {/* 개요 */}
      {tab === 'overview' && (
        <div>
          {aiComment && (() => {
            const signalColor = aiComment.signal === 'bullish' ? '#16a34a' : aiComment.signal === 'bearish' ? '#ef4444' : 'var(--text-tertiary)';
            const signalLabel = aiComment.signal === 'bullish' ? '🟢 매수 우위' : aiComment.signal === 'bearish' ? '🔴 매도 우위' : '🟡 중립';
            return (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>🤖 AI 한줄평</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: signalColor }}>{signalLabel}</span>
                </div>
                <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{aiComment.content}</p>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>
                  {new Date(aiComment.created_at).toLocaleDateString('ko-KR')} 기준 · AI 분석은 참고용
                </div>
              </div>
            );
          })()}
          <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>🏢 회사 소개</div>
            <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{description}</p>
          </div>
        </div>
      )}

      {/* 차트 */}
      {tab === 'chart' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          {priceHistory.length >= 2 ? (
            <>
              {/* Candlestick if OHLC data available */}
              {priceHistory.some((d: any) => d.open_price && d.high_price && d.low_price) ? (
                <div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>📊 캔들스틱 차트</div>
                  <CandlestickChart
                    data={priceHistory.filter((d: any) => d.open_price && d.high_price && d.low_price).map((d: any) => ({
                      date: d.date,
                      open: d.open_price,
                      high: d.high_price,
                      low: d.low_price,
                      close: d.close_price,
                      volume: d.volume || 0,
                    }))}
                    height={220}
                    showVolume={true}
                  />
                </div>
              ) : (
                <MiniChart data={priceHistory} />
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>📊 거래 데이터가 쌓이면 차트가 표시됩니다<br/><span style={{ fontSize: 'var(--fs-xs)' }}>보통 상장 후 2~3일 내에 업데이트</span></div>
          )}
        </div>
      )}

      {/* 수급 */}
      {tab === 'flow' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📊 투자자별 수급</div>
          {investorFlow.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>📊 외국인·기관 매매 데이터가 수집되면 표시됩니다</div>
          ) : investorFlow.map((d: any) => {
            const foreignNet = (d.foreign_buy || 0) - (d.foreign_sell || 0);
            const instNet = (d.inst_buy || 0) - (d.inst_sell || 0);
            const maxVal = Math.max(Math.abs(foreignNet), Math.abs(instNet), 1);
            return (
              <div key={d.date || d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', minWidth: 50 }}>{(d.date || '').slice(5)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', minWidth: 36, color: 'var(--text-tertiary)' }}>외국인</span>
                    <div style={{ flex: 1, height: 12, background: 'var(--bg-hover)', borderRadius: 6, overflow: 'hidden', display: 'flex', justifyContent: foreignNet >= 0 ? 'flex-start' : 'flex-end' }}>
                      <div style={{ width: `${Math.abs(foreignNet) / maxVal * 100}%`, height: '100%', background: foreignNet >= 0 ? '#3b82f6' : '#ef4444', borderRadius: 6, minWidth: 2 }} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, minWidth: 50, textAlign: 'right', color: foreignNet >= 0 ? '#3b82f6' : '#ef4444' }}>
                      {foreignNet >= 0 ? '+' : ''}{(foreignNet / 10000).toFixed(1)}만
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', minWidth: 36, color: 'var(--text-tertiary)' }}>기관</span>
                    <div style={{ flex: 1, height: 12, background: 'var(--bg-hover)', borderRadius: 6, overflow: 'hidden', display: 'flex', justifyContent: instNet >= 0 ? 'flex-start' : 'flex-end' }}>
                      <div style={{ width: `${Math.abs(instNet) / maxVal * 100}%`, height: '100%', background: instNet >= 0 ? '#f59e0b' : '#ef4444', borderRadius: 6, minWidth: 2 }} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, minWidth: 50, textAlign: 'right', color: instNet >= 0 ? '#f59e0b' : '#ef4444' }}>
                      {instNet >= 0 ? '+' : ''}{(instNet / 10000).toFixed(1)}만
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 뉴스 */}
      {tab === 'news' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📰 관련 뉴스</div>
          {news.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>📰 최근 관련 뉴스가 없습니다<br/><span style={{ fontSize: 'var(--fs-xs)' }}>새로운 뉴스가 발행되면 자동으로 수집됩니다</span></div>
          ) : news.map((n: any) => (
            <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{n.title}</div>
                {n.sentiment_label && (
                  <span style={{
                    fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 8, fontWeight: 700, flexShrink: 0,
                    background: n.sentiment_label === 'positive' ? 'rgba(34,197,94,0.15)' : n.sentiment_label === 'negative' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.1)',
                    color: n.sentiment_label === 'positive' ? '#ef4444' : n.sentiment_label === 'negative' ? '#3b82f6' : '#94a3b8',
                  }}>
                    {n.sentiment_label === 'positive' ? '🟢' : n.sentiment_label === 'negative' ? '🔴' : '⚪'}
                    {n.sentiment_score ? ` ${Math.round(n.sentiment_score * 100)}%` : ''}
                  </span>
                )}
              </div>
              {n.ai_summary && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{n.ai_summary}</div>}
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', gap: 6 }}>
                <span>{n.source || '뉴스'}</span>
                <span>{timeAgo(n.published_at)}</span>
                {!n.sentiment_label && n.sentiment === 'positive' && <span>🟢</span>}
                {!n.sentiment_label && n.sentiment === 'negative' && <span>🔴</span>}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* 공시 */}
      {tab === 'disclosure' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📋 최근 공시</div>
          {disclosures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>📋 최근 공시 내역이 없습니다<br/><span style={{ fontSize: 'var(--fs-xs)' }}>DART 공시 등록 시 자동으로 수집됩니다</span></div>
          ) : disclosures.map((d: any) => {
            const typeMap: Record<string, string> = { earnings: '📈실적', dividend: '💰배당', buyback: '🔄자사주', contract: '📝수주', ir: '🎤IR' };
            return (
              <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {typeMap[d.disclosure_type] || '📋공시'}
                  </span>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{d.title}</span>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {d.source || 'DART'} · {timeAgo(d.published_at || d.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 토론 */}
      {tab === 'discuss' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <StockComments symbol={symbol} stockName={stockName} />
        </div>
      )}
    </div>
  );
}
