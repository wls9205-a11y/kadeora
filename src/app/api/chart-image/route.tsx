import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * 동적 차트 이미지 생성 API
 * 
 * /api/chart-image?symbol=005930&period=30d
 * /api/chart-image?symbol=AAPL&period=1y
 * /api/chart-image?compare=005930,000660&period=3m
 * 
 * OG 이미지·블로그 본문 삽입용 차트 PNG 생성
 * Vercel Edge Cache 1시간
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || '';
  const compare = searchParams.get('compare') || '';
  const period = searchParams.get('period') || '30d';
  const width = parseInt(searchParams.get('w') || '800');
  const height = parseInt(searchParams.get('h') || '400');

  const symbols = compare ? compare.split(',').map(s => s.trim()) : [symbol];
  if (!symbols[0]) {
    return new Response('Missing symbol or compare param', { status: 400 });
  }

  // DB에서 price_history 조회
  const sb = await createSupabaseServer();
  const periodDays = period === '1y' ? 365 : period === '6m' ? 180 : period === '3m' ? 90 : period === '7d' ? 7 : 30;
  const since = new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10);

  const allData: Record<string, Array<{ date: string; close: number }>> = {};

  for (const sym of symbols.slice(0, 3)) {
    const { data } = await (sb as any)
      .from('stock_price_history')
      .select('date, close_price')
      .eq('symbol', sym)
      .gte('date', since)
      .order('date', { ascending: true })
      .limit(400);

    allData[sym] = (data || []).map((d: any) => ({
      date: d.date,
      close: Number(d.close_price),
    }));
  }

  // 종목 이름 조회
  const { data: stockInfo } = await sb
    .from('stock_quotes')
    .select('symbol, name, price, change_pct')
    .in('symbol', symbols);
  const nameMap: Record<string, string> = {};
  const priceMap: Record<string, { price: number; change: number }> = {};
  for (const s of (stockInfo || []) as any[]) {
    nameMap[s.symbol] = s.name;
    priceMap[s.symbol] = { price: s.price, change: Number(s.change_pct ?? 0) };
  }

  const primarySymbol = symbols[0];
  const primaryData = allData[primarySymbol] || [];

  if (!primaryData.length) {
    return new Response('No price data', { status: 404 });
  }

  // 차트 SVG 포인트 계산
  const chartW = width - 80;
  const chartH = height - 100;
  const chartX = 60;
  const chartY = 60;

  const allPrices = primaryData.map(d => d.close);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;

  const toX = (i: number) => chartX + (i / (primaryData.length - 1 || 1)) * chartW;
  const toY = (price: number) => chartY + chartH - ((price - minPrice) / priceRange) * chartH;

  // 폴리라인 포인트
  const linePoints = primaryData.map((d, i) => `${toX(i).toFixed(1)},${toY(d.close).toFixed(1)}`).join(' ');

  // 그라데이션 영역
  const areaPoints = `${toX(0)},${chartY + chartH} ${linePoints} ${toX(primaryData.length - 1)},${chartY + chartH}`;

  const currentPrice = priceMap[primarySymbol]?.price ?? primaryData[primaryData.length - 1]?.close;
  const changePct = priceMap[primarySymbol]?.change ?? 0;
  const isUp = changePct >= 0;
  const lineColor = isUp ? '#ef4444' : '#3b82f6';
  const bgColor = '#0f172a';

  return new ImageResponse(
    (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background: bgColor,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
          padding: '16px',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>
              {nameMap[primarySymbol] || primarySymbol}
            </span>
            <span style={{ color: '#fff', fontSize: '24px', fontWeight: 700 }}>
              {currentPrice?.toLocaleString()}
            </span>
          </div>
          <span style={{
            color: isUp ? '#ef4444' : '#3b82f6',
            fontSize: '18px',
            fontWeight: 600,
          }}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>

        {/* 차트 SVG */}
        <svg width={width - 32} height={height - 80} viewBox={`0 0 ${width} ${height - 60}`}>
          {/* 그리드 */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const y = chartY + chartH * (1 - pct);
            const price = minPrice + priceRange * pct;
            return (
              <g key={pct}>
                <line x1={chartX} y1={y} x2={chartX + chartW} y2={y} stroke="#1e293b" strokeWidth="1" />
                <text x={chartX - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11">
                  {price >= 10000 ? `${(price / 10000).toFixed(1)}만` : price.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* 그라데이션 영역 */}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#areaGrad)" />

          {/* 라인 */}
          <polyline
            points={linePoints}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* 마지막 점 */}
          <circle
            cx={toX(primaryData.length - 1)}
            cy={toY(primaryData[primaryData.length - 1].close)}
            r="4"
            fill={lineColor}
          />
        </svg>

        {/* 푸터 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ color: '#475569', fontSize: '11px' }}>
            {primaryData[0]?.date}
          </span>
          <span style={{ color: '#475569', fontSize: '11px' }}>
            kadeora.app · {period}
          </span>
          <span style={{ color: '#475569', fontSize: '11px' }}>
            {primaryData[primaryData.length - 1]?.date}
          </span>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    },
  );
}
