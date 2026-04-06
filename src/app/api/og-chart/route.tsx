import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 15;

let _font: ArrayBuffer | null = null;
function font(): ArrayBuffer | null {
  if (_font) return _font;
  try { _font = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.otf')).buffer as ArrayBuffer; } catch {}
  return _font;
}

export async function GET(req: NextRequest) {
  const { searchParams: sp } = req.nextUrl;
  const symbol = sp.get('symbol');
  const apt = sp.get('apt');

  const sb = getSupabaseAdmin();
  const f = font();

  if (symbol) {
    const { data: s } = await sb.from('stock_quotes').select('name, symbol, market, price, change_pct, market_cap, per, pbr, dividend_yield, high_52w, low_52w, sector').eq('symbol', symbol).maybeSingle();
    if (!s) return new Response('Not found', { status: 404 });

    const isKR = s.market === 'KOSPI' || s.market === 'KOSDAQ';
    const price = isKR ? `${Number(s.price).toLocaleString()}원` : `$${Number(s.price).toFixed(2)}`;
    const chg = Number(s.change_pct);
    const chgColor = chg >= 0 ? '#00FF87' : '#FF4444';
    const chgText = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
    const cap = s.market_cap ? (isKR ? `${(Number(s.market_cap)/1e12).toFixed(1)}조원` : `$${(Number(s.market_cap)/1e9).toFixed(0)}B`) : '-';

    const buf = await new ImageResponse(
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'linear-gradient(135deg, #050A18 0%, #0C1528 50%, #050A18 100%)', padding: '48px 56px', fontFamily: '"Noto Sans KR"' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: '#3B7BF6', background: 'rgba(59,123,246,0.15)', padding: '4px 14px', borderRadius: 20, fontWeight: 700 }}>{s.market} · {s.sector || '미분류'}</div>
          <div style={{ fontSize: 13, color: '#888', marginLeft: 'auto' }}>kadeora.app</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{s.name}</span>
          <span style={{ fontSize: 20, color: '#888' }}>{s.symbol}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 32 }}>
          <span style={{ fontSize: 48, fontWeight: 700, color: '#fff' }}>{price}</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: chgColor }}>{chgText}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flex: 1 }}>
          {[
            { label: '시가총액', value: cap },
            { label: 'PER', value: s.per ? `${Number(s.per).toFixed(1)}배` : '-' },
            { label: 'PBR', value: s.pbr ? `${Number(s.pbr).toFixed(2)}배` : '-' },
            { label: '배당률', value: s.dividend_yield ? `${Number(s.dividend_yield).toFixed(1)}%` : '-' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 16px', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{item.label}</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{item.value}</span>
            </div>
          ))}
        </div>
        {s.high_52w && s.low_52w && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: '12px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
            <span style={{ fontSize: 13, color: '#888' }}>52주</span>
            <span style={{ fontSize: 16, color: '#FF4444' }}>{Number(s.low_52w).toLocaleString()}</span>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, position: 'relative', display: 'flex' }}>
              <div style={{ position: 'absolute', left: `${Math.min(Math.max(((Number(s.price) - Number(s.low_52w)) / (Number(s.high_52w) - Number(s.low_52w))) * 100, 2), 98)}%`, top: -4, width: 14, height: 14, borderRadius: 7, background: '#3B7BF6' }} />
            </div>
            <span style={{ fontSize: 16, color: '#00FF87' }}>{Number(s.high_52w).toLocaleString()}</span>
          </div>
        )}
      </div>,
      { width: 1200, height: 630, fonts: f ? [{ name: 'Noto Sans KR', data: f, style: 'normal' as const, weight: 700 as const }] : [] }
    ).arrayBuffer();
    return new Response(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } });
  }

  if (apt) {
    const { data: site } = await (sb as any).from('apt_sites').select('name, region, sigungu, builder, total_units, price_min, price_max, move_in_date, nearby_station, school_district').eq('slug', apt).eq('is_active', true).maybeSingle();
    if (!site) return new Response('Not found', { status: 404 });

    const pMin = site.price_min ? `${(site.price_min/10000).toFixed(1)}억` : '-';
    const pMax = site.price_max ? `${(site.price_max/10000).toFixed(1)}억` : '-';
    const moveIn = site.move_in_date ? `${String(site.move_in_date).slice(0,4)}년 ${String(site.move_in_date).slice(4,6)}월` : '미정';

    const buf = await new ImageResponse(
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'linear-gradient(135deg, #050A18 0%, #0C1528 50%, #050A18 100%)', padding: '48px 56px', fontFamily: '"Noto Sans KR"' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: '#00FF87', background: 'rgba(0,255,135,0.15)', padding: '4px 14px', borderRadius: 20, fontWeight: 700 }}>{site.region} {site.sigungu || ''}</div>
          <div style={{ fontSize: 13, color: '#888', marginLeft: 'auto' }}>kadeora.app</div>
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{site.name}</div>
        <div style={{ fontSize: 18, color: '#888', marginBottom: 32 }}>{site.builder || ''} · {site.total_units ? `${site.total_units.toLocaleString()}세대` : ''} · 입주 {moveIn}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '20px 24px', background: 'rgba(0,255,135,0.08)', borderRadius: 16, border: '1px solid rgba(0,255,135,0.2)' }}>
          <span style={{ fontSize: 16, color: '#00FF87' }}>분양가</span>
          <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{pMin} ~ {pMax}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flex: 1 }}>
          {[
            { label: '세대수', value: site.total_units ? `${site.total_units.toLocaleString()}세대` : '-' },
            { label: '인근역', value: site.nearby_station ? site.nearby_station.split('(')[0] : '-' },
            { label: '학군', value: site.school_district || '-' },
            { label: '입주', value: moveIn },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 16px', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{item.label}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', textAlign: 'center' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>,
      { width: 1200, height: 630, fonts: f ? [{ name: 'Noto Sans KR', data: f, style: 'normal' as const, weight: 700 as const }] : [] }
    ).arrayBuffer();
    return new Response(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } });
  }

  return new Response('symbol or apt required', { status: 400 });
}
