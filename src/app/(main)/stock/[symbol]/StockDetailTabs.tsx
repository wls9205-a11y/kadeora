'use client';
import type { StockPriceHistory, StockNews, InvestorFlow, Disclosure, AIComment } from '@/types/stock';
import { useState } from 'react';
import StockComments from '@/components/StockComments';
import CandlestickChart from '@/components/charts/CandlestickChart';
import { timeAgo } from '@/lib/format';



interface Props {
  symbol: string;
  stockName: string;
  aiComment: AIComment | null;
  priceHistory: StockPriceHistory[];
  news: StockNews[];
  investorFlow: InvestorFlow[];
  disclosures: Disclosure[];
  description: string;
  currency: string;
}

function MiniChart({ data }: { data: { date: string; close_price: number; open_price?: number | null; volume?: number | null }[] }) {
  if (!data || data.length < 2) return null;
  const prices = data.map(d => Number(d.close_price));
  const min = Math.min(...prices); const max = Math.max(...prices);
  const range = max - min || 1; const W = 300; const H = 80; const P = 4;
  const points = prices.map((p, i) => `${P + (i / (prices.length - 1)) * (W - P * 2)},${H - P - ((p - min) / range) * (H - P * 2)}`).join(' ');
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? 'var(--accent-red)' : 'var(--accent-blue)';
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
      {/* Volume bars */}
      {data.some(d => (d.volume ?? 0) > 0) && (
        <svg viewBox={`0 0 ${data.length * 6} 40`} style={{ width: '100%', height: 40, display: 'block', marginTop: 2 }}>
          {data.map((d, i) => {
            const maxVol = Math.max(...data.map(v => v.volume || 0)) || 1;
            const h = ((d.volume || 0) / maxVol) * 36;
            const isUp = (d.close_price || 0) >= (d.open_price || 0);
            return <rect key={i} x={i * 6} y={40 - h} width={5} height={h} fill={isUp ? 'var(--accent-red)' : 'var(--accent-blue)'} opacity={0.5} rx={1} />;
          })}
        </svg>
      )}
    </div>
  );
}

const PERIODS = [
  { key: '1w', label: '1주', days: 7 },
  { key: '1m', label: '1개월', days: 30 },
  { key: '3m', label: '3개월', days: 90 },
  { key: 'all', label: '전체', days: 999 },
] as const;

function ChartTab({ priceHistory, currency }: { priceHistory: StockPriceHistory[]; currency: string }) {
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [period, setPeriod] = useState<string>('all');

  const hasOHLC = priceHistory.some((d) => d.open_price && d.high_price && d.low_price);

  const periodDays = PERIODS.find(p => p.key === period)?.days ?? 999;
  const slicedData = periodDays >= 999
    ? priceHistory
    : priceHistory.slice(-periodDays);

  if (slicedData.length < 2) {
    return (
      <div className="kd-card">
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
          📊 거래 데이터가 쌓이면 차트가 표시됩니다
          <br /><span style={{ fontSize: 'var(--fs-xs)' }}>보통 상장 후 2~3일 내에 업데이트</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
      {/* 컨트롤 바: 차트 타입 토글 + 기간 선택 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        {hasOHLC && (
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: 6, padding: 2 }}>
            {(['candle', 'line'] as const).map(t => (
              <button key={t} onClick={() => setChartType(t)} style={{
                padding: '4px 10px', border: 'none', borderRadius: 5, cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                background: chartType === t ? 'var(--brand)' : 'transparent',
                color: chartType === t ? '#fff' : 'var(--text-tertiary)',
              }}>
                {t === 'candle' ? '캔들' : '라인'}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 3 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding: '3px 9px', border: 'none', borderRadius: 5, cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              background: period === p.key ? 'var(--brand)' : 'var(--bg-hover)',
              color: period === p.key ? '#fff' : 'var(--text-tertiary)',
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 렌더링 */}
      {chartType === 'candle' && hasOHLC ? (
        <CandlestickChart
          data={slicedData.filter((d) => d.open_price && d.high_price && d.low_price).map((d) => ({
            date: d.date,
            open: Number(d.open_price),
            high: Number(d.high_price),
            low: Number(d.low_price),
            close: Number(d.close_price),
            volume: Number(d.volume) || 0,
          }))}
          height={260}
          showVolume={true}
          currency={currency}
        />
      ) : (
        <MiniChart data={slicedData} />
      )}

      {/* 변동 요약 */}
      {slicedData.length >= 2 && (() => {
        const first = Number(slicedData[0].close_price);
        const last = Number(slicedData[slicedData.length - 1].close_price);
        const change = last - first;
        const changePct = first > 0 ? (change / first * 100) : 0;
        const high = Math.max(...slicedData.map((d) => Number(d.high_price || d.close_price)));
        const low = Math.min(...slicedData.map((d) => Number(d.low_price || d.close_price)).filter((v: number) => v > 0));
        const isUp = change >= 0;
        return (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 80, background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>기간 변동</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: isUp ? 'var(--accent-red)' : 'var(--accent-blue)', marginTop: 2 }}>
                {isUp ? '+' : ''}{changePct.toFixed(2)}%
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 80, background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>최고가</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-red)', marginTop: 2 }}>
                {currency === 'USD' ? `$${high.toFixed(2)}` : `₩${high.toLocaleString()}`}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 80, background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>최저가</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-blue)', marginTop: 2 }}>
                {currency === 'USD' ? `$${low.toFixed(2)}` : `₩${low.toLocaleString()}`}
              </div>
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
      <div className="apt-pill-scroll" style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 6, flexShrink: 0,
            background: tab === t.key ? 'var(--brand)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--text-tertiary)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* 개요 */}
      {tab === 'overview' && (
        <div>
          {/* 미니 차트 (개요 상단) */}
          {priceHistory.length >= 2 && (
            <div className="kd-card">
              <MiniChart data={priceHistory} />
            </div>
          )}
          {aiComment && (() => {
            const signalColor = aiComment.signal === 'bullish' ? '#059669' : aiComment.signal === 'bearish' ? 'var(--accent-red)' : 'var(--text-tertiary)';
            const signalLabel = aiComment.signal === 'bullish' ? '🟢 매수 우위' : aiComment.signal === 'bearish' ? '🔴 매도 우위' : '🟡 중립';
            const signalBg = aiComment.signal === 'bullish' ? 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(5,150,105,0.02))' : aiComment.signal === 'bearish' ? 'linear-gradient(135deg, rgba(248,113,113,0.08), rgba(248,113,113,0.02))' : 'var(--bg-surface)';
            const signalBorder = aiComment.signal === 'bullish' ? '1px solid rgba(5,150,105,0.2)' : aiComment.signal === 'bearish' ? '1px solid rgba(248,113,113,0.2)' : '1px solid var(--border)';
            return (
              <div className="kd-card" style={{ background: signalBg, border: signalBorder }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>🤖 AI 한줄평</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: signalColor, padding: '2px 10px', borderRadius: 999, background: aiComment.signal === 'bullish' ? 'rgba(5,150,105,0.12)' : aiComment.signal === 'bearish' ? 'rgba(248,113,113,0.12)' : 'var(--bg-hover)' }}>{signalLabel}</span>
                </div>
                <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{aiComment.comment || aiComment.content}</p>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>
                  {new Date(aiComment.created_at || '').toLocaleDateString('ko-KR')} 기준 · AI 분석은 참고용
                </div>
              </div>
            );
          })()}
          {!aiComment && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>🤖 AI 한줄평</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>이 종목의 AI 분석이 준비되면 표시됩니다</div>
            </div>
          )}
          <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>🏢 회사 소개</div>
            <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{description}</p>
          </div>
        </div>
      )}

      {/* 차트 */}
      {tab === 'chart' && (
        <ChartTab priceHistory={priceHistory} currency={currency} />
      )}

      {/* 수급 */}
      {tab === 'flow' && (
        <div className="kd-card">
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📊 투자자별 수급</div>
          {investorFlow.length > 0 && (() => {
            const totalForeign = investorFlow.reduce((s: number, d) => s + ((d.foreign_buy || 0) - (d.foreign_sell || 0)), 0);
            const totalInst = investorFlow.reduce((s: number, d) => s + ((d.inst_buy || 0) - (d.inst_sell || 0)), 0);
            return (
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>외국인 누적</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: totalForeign >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)', marginTop: 2 }}>{totalForeign >= 0 ? '순매수' : '순매도'} {Math.abs(Math.round(totalForeign / 10000))}만</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>기관 누적</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: totalInst >= 0 ? 'var(--accent-yellow)' : 'var(--accent-red)', marginTop: 2 }}>{totalInst >= 0 ? '순매수' : '순매도'} {Math.abs(Math.round(totalInst / 10000))}만</div>
                </div>
              </div>
            );
          })()}
          {investorFlow.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>📊 외국인·기관 매매 데이터가 수집되면 표시됩니다</div>
          ) : investorFlow.map((d) => {
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
                      <div style={{ width: `${Math.abs(foreignNet) / maxVal * 100}%`, height: '100%', background: foreignNet >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)', borderRadius: 6, minWidth: 2 }} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, minWidth: 50, textAlign: 'right', color: foreignNet >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)' }}>
                      {foreignNet >= 0 ? '+' : ''}{(foreignNet / 10000).toFixed(1)}만
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', minWidth: 36, color: 'var(--text-tertiary)' }}>기관</span>
                    <div style={{ flex: 1, height: 12, background: 'var(--bg-hover)', borderRadius: 6, overflow: 'hidden', display: 'flex', justifyContent: instNet >= 0 ? 'flex-start' : 'flex-end' }}>
                      <div style={{ width: `${Math.abs(instNet) / maxVal * 100}%`, height: '100%', background: instNet >= 0 ? 'var(--accent-yellow)' : 'var(--accent-red)', borderRadius: 6, minWidth: 2 }} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, minWidth: 50, textAlign: 'right', color: instNet >= 0 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
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
        <div className="kd-card">
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📰 관련 뉴스</div>
          {news.length > 0 && (() => {
            const pos = news.filter((n) => n.sentiment_label === 'positive' || n.sentiment === 'positive').length;
            const neg = news.filter((n) => n.sentiment_label === 'negative' || n.sentiment === 'negative').length;
            const neu = news.length - pos - neg;
            const total = news.length || 1;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>긍정 {pos}</span>
                <span>중립 {neu}</span>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>부정 {neg}</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(pos/total)*100}%`, background: 'var(--accent-red)' }} />
                  <div style={{ width: `${(neu/total)*100}%`, background: 'var(--bg-hover)' }} />
                  <div style={{ width: `${(neg/total)*100}%`, background: 'var(--accent-blue)' }} />
                </div>
              </div>
            );
          })()}
          {news.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>📰 최근 관련 뉴스가 없습니다<br/><span style={{ fontSize: 'var(--fs-xs)' }}>새로운 뉴스가 발행되면 자동으로 수집됩니다</span></div>
          ) : news.map((n) => (
            <a key={n.id} href={n.url || "#"} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{n.title}</div>
                {n.sentiment_label && (
                  <span style={{
                    fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 8, fontWeight: 700, flexShrink: 0,
                    background: n.sentiment_label === 'positive' ? 'var(--accent-green-bg)' : n.sentiment_label === 'negative' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.1)',
                    color: n.sentiment_label === 'positive' ? 'var(--accent-red)' : n.sentiment_label === 'negative' ? 'var(--accent-blue)' : 'var(--text-secondary)',
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
        <div className="kd-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📋 최근 공시</div>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{disclosures.length}건</span>
          </div>
          {disclosures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>📋 최근 공시 내역이 없습니다<br/><span style={{ fontSize: 'var(--fs-xs)' }}>DART 공시 등록 시 자동으로 수집됩니다</span></div>
          ) : disclosures.map((d) => {
            const typeMap: Record<string, string> = { earnings: '📈실적', dividend: '💰배당', buyback: '🔄자사주', contract: '📝수주', ir: '🎤IR' };
            return (
              <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {typeMap[d.disclosure_type || ""] || '📋공시'}
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
        <div className="kd-card">
          <StockComments symbol={symbol} stockName={stockName} />
        </div>
      )}
    </div>
  );
}
