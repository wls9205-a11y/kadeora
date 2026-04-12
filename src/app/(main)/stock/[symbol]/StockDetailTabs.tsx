'use client';
import { stockColor, stockUpColor, stockDownColor, investorColor, investorBg, signalColor, signalBg, sentimentColor, sentimentBg, isKRMarket } from '@/lib/stockColor';
import type { StockPriceHistory, StockNews, InvestorFlow, Disclosure, AIComment } from '@/types/stock';
import { useState } from 'react';
import StockComments from '@/components/StockComments';
import dynamic from 'next/dynamic';
import { timeAgo } from '@/lib/format';

const CandlestickChart = dynamic(() => import('@/components/charts/CandlestickChart'), { ssr: false });
const StockTrendLine = dynamic(() => import('@/components/StockTrendLine'), { ssr: false });



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

function MiniChart({ data, isKR = true }: { data: { date: string; close_price: number; open_price?: number | null; volume?: number | null }[]; isKR?: boolean }) {
  if (!data || data.length < 2) return null;
  const prices = data.map(d => Number(d.close_price));
  const min = Math.min(...prices); const max = Math.max(...prices);
  const range = max - min || 1; const W = 300; const H = 80; const P = 4;
  const points = prices.map((p, i) => `${P + (i / (prices.length - 1)) * (W - P * 2)},${H - P - ((p - min) / range) * (H - P * 2)}`).join(' ');
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = stockColor(isUp ? 1 : -1, isKR);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>
        <span style={{ fontWeight: 600 }}>📈 1개월 추이</span>
        <span style={{ color, fontWeight: 700 }}>{isUp ? '▲' : '▼'} {((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(1)}%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
        <span>{data[0].date.slice(5)}</span>
        <span>{data[data.length - 1].date.slice(5)}</span>
      </div>
      {/* 52주 범위 */}
      {prices.length > 5 && (() => {
        const low = Math.min(...prices); const high = Math.max(...prices);
        const current = prices[prices.length - 1];
        const pos = high > low ? ((current - low) / (high - low)) * 100 : 50;
        return (
          <div style={{ marginTop: 'var(--sp-md)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-xs)' }}>가격 범위</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
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

const PERIODS = [
  { key: '1w', label: '1주', days: 7 },
  { key: '1m', label: '1개월', days: 30 },
  { key: '3m', label: '3개월', days: 90 },
  { key: '6m', label: '6개월', days: 180 },
  { key: '1y', label: '1년', days: 365 },
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
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 10 }}>
      {/* 컨트롤 바: 차트 타입 토글 + 기간 선택 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        {hasOHLC && (
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)', padding: 2 }}>
            {(['candle', 'line'] as const).map(t => (
              <button aria-label="닫기" key={t} onClick={() => setChartType(t)} style={{
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
          showVolume={false}
          currency={currency}
        />
      ) : (
        <MiniChart data={slicedData} isKR={currency !== 'USD'} />
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
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 'var(--sp-md)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 80, background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>기간 변동</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: stockColor(isUp ? 1 : -1, currency !== 'USD'), marginTop: 2 }}>
                {isUp ? '+' : ''}{changePct.toFixed(2)}%
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 80, background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>최고가</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: stockUpColor(currency !== 'USD'), marginTop: 2 }}>
                {currency === 'USD' ? `$${high.toFixed(2)}` : `₩${high.toLocaleString()}`}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 80, background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>최저가</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: stockDownColor(currency !== 'USD'), marginTop: 2 }}>
                {currency === 'USD' ? `$${low.toFixed(2)}` : `₩${low.toLocaleString()}`}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 트렌드라인 오버레이 */}
      {slicedData.length >= 10 && (
        <StockTrendLine
          data={slicedData.map((d: any) => ({ date: d.date, close_price: Number(d.close_price), volume: Number(d.volume || 0), change_pct: Number(d.change_pct || 0) }))}
          currency={currency}
          isKR={currency !== 'USD'}
        />
      )}
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-md)', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as any }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 14px', border: tab === t.key ? 'none' : '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 16, flexShrink: 0, fontFamily: 'inherit',
            background: tab === t.key ? 'var(--brand)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}>
            {t.label}
            {t.key === 'disclosure' && disclosures?.some((d: Disclosure) => new Date(d.published_at || d.created_at || '').getTime() > Date.now() - 86400000) && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-red)', display: 'inline-block' }} />
            )}
          </button>
        ))}
      </div>

      {/* 개요 */}
      {tab === 'overview' && (
        <div>
          {/* 미니 차트 (개요 상단) */}
          {priceHistory.length >= 2 && (
            <div className="kd-card">
              <MiniChart data={priceHistory} isKR={currency !== 'USD'} />
            </div>
          )}
          {aiComment && (() => {
            const sigColor = signalColor(aiComment.signal || 'neutral');
            const signalLabel = aiComment.signal === 'bullish' ? '🟢 매수 우위' : aiComment.signal === 'bearish' ? '🔴 매도 우위' : '🟡 중립';
            const cardBg = aiComment.signal === 'bullish' ? 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(5,150,105,0.02))' : aiComment.signal === 'bearish' ? 'linear-gradient(135deg, rgba(248,113,113,0.08), rgba(248,113,113,0.02))' : 'var(--bg-surface)';
            const signalBorder = aiComment.signal === 'bullish' ? '1px solid rgba(5,150,105,0.2)' : aiComment.signal === 'bearish' ? '1px solid rgba(248,113,113,0.2)' : '1px solid var(--border)';
            return (
              <div className="kd-card" style={{ background: cardBg, border: signalBorder }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>🤖 AI 한줄평</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: sigColor, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: signalBg(aiComment.signal || 'neutral') }}>{signalLabel}</span>
                </div>
                <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{aiComment.comment || aiComment.content}</p>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-sm)' }}>
                  {new Date(aiComment.created_at || '').toLocaleDateString('ko-KR')} 기준 · AI 분석은 참고용
                </div>
              </div>
            );
          })()}
          {!aiComment && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-lg)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-xs)' }}>🤖 AI 한줄평</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>이 종목의 AI 분석이 준비되면 표시됩니다</div>
            </div>
          )}
          <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-lg)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>🏢 회사 소개</div>
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
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>📊 투자자별 수급</div>
          {investorFlow.length > 0 && (() => {
            const totalForeign = investorFlow.reduce((s: number, d) => s + ((d.foreign_buy || 0) - (d.foreign_sell || 0)), 0);
            const totalInst = investorFlow.reduce((s: number, d) => s + ((d.inst_buy || 0) - (d.inst_sell || 0)), 0);
            return (
              <div style={{ display: 'flex', gap: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
                <div style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>외국인 누적</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: investorColor('foreign'), marginTop: 2 }}>{totalForeign >= 0 ? '순매수' : '순매도'} {Math.abs(Math.round(totalForeign / 10000))}만</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>기관 누적</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: investorColor('inst'), marginTop: 2 }}>{totalInst >= 0 ? '순매수' : '순매도'} {Math.abs(Math.round(totalInst / 10000))}만</div>
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
                    <div style={{ flex: 1, height: 12, background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', display: 'flex', justifyContent: foreignNet >= 0 ? 'flex-start' : 'flex-end' }}>
                      <div style={{ width: `${Math.abs(foreignNet) / maxVal * 100}%`, height: '100%', background: investorColor('foreign'), borderRadius: 'var(--radius-xs)', minWidth: 2 }} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, minWidth: 50, textAlign: 'right', color: investorColor('foreign') }}>
                      {foreignNet >= 0 ? '+' : ''}{(foreignNet / 10000).toFixed(1)}만
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', minWidth: 36, color: 'var(--text-tertiary)' }}>기관</span>
                    <div style={{ flex: 1, height: 12, background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', display: 'flex', justifyContent: instNet >= 0 ? 'flex-start' : 'flex-end' }}>
                      <div style={{ width: `${Math.abs(instNet) / maxVal * 100}%`, height: '100%', background: investorColor('inst'), borderRadius: 'var(--radius-xs)', minWidth: 2 }} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, minWidth: 50, textAlign: 'right', color: investorColor('inst') }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--stock-positive)', fontWeight: 600 }}>긍정 {pos}</span>
                <span>중립 {neu}</span>
                <span style={{ color: 'var(--stock-negative)', fontWeight: 600 }}>부정 {neg}</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(pos/total)*100}%`, background: 'var(--stock-positive)' }} />
                  <div style={{ width: `${(neu/total)*100}%`, background: 'var(--bg-hover)' }} />
                  <div style={{ width: `${(neg/total)*100}%`, background: 'var(--stock-negative)' }} />
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
                    fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 700, flexShrink: 0,
                    background: sentimentBg(n.sentiment_label || 'neutral'),
                    color: sentimentColor(n.sentiment_label || 'neutral'),
                  }}>
                    {n.sentiment_label === 'positive' ? '🟢' : n.sentiment_label === 'negative' ? '🔴' : '⚪'}
                    {n.sentiment_score ? ` ${Math.round(n.sentiment_score * 100)}%` : ''}
                  </span>
                )}
              </div>
              {n.ai_summary && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{n.ai_summary}</div>}
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)', display: 'flex', gap: 6 }}>
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
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
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
