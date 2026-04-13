import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 15;

let _font: ArrayBuffer | null = null;
function loadFont(): ArrayBuffer | null {
  if (_font) return _font;
  try {
    const buf = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.woff'));
    _font = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _font;
  } catch { return null; }
}
function fontOpts() {
  const d = loadFont();
  return d ? { fonts: [{ name: 'NK', data: d, style: 'normal' as const, weight: 700 as const }] } : {};
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = sp.get('symbol');
  const apt = sp.get('apt');

  // 파라미터 없으면 빠른 반환 (DB 호출 불필요)
  if (!symbol && !apt) {
    return new Response('?symbol=XXX or ?apt=slug', { status: 400 });
  }

  try {
  const sb = getSupabaseAdmin();
    if (symbol) {
      const { data: s } = await (sb as any).from('stock_quotes')
        .select('name, symbol, market, price, change_pct, market_cap, per, pbr, dividend_yield, sector')
        .eq('symbol', symbol.toUpperCase()).maybeSingle();
      if (!s) return new Response('Not found', { status: 404 });

      const isKR = s.market === 'KOSPI' || s.market === 'KOSDAQ';
      const price = isKR ? `${Number(s.price || 0).toLocaleString()}원` : `$${Number(s.price || 0).toFixed(2)}`;
      const chg = Number(s.change_pct || 0);
      const chgColor = chg >= 0 ? '#00FF87' : '#FF4444';
      const chgText = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
      const cap = Number(s.market_cap) > 0 ? (isKR ? `${(Number(s.market_cap) / 1e12).toFixed(1)}조` : `$${(Number(s.market_cap) / 1e9).toFixed(0)}B`) : '-';
      const per = s.per ? `${Number(s.per).toFixed(1)}배` : '-';
      const pbr = s.pbr ? `${Number(s.pbr).toFixed(2)}배` : '-';
      const dy = s.dividend_yield ? `${Number(s.dividend_yield).toFixed(1)}%` : '-';

      const buf = await new ImageResponse(
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#050A18', padding: '48px 56px', fontFamily: 'NK' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', fontSize: 14, color: '#3B7BF6', background: 'rgba(59,123,246,0.15)', padding: '4px 14px', borderRadius: 20 }}>{s.market}</div>
            <div style={{ display: 'flex', fontSize: 13, color: '#666', marginLeft: 'auto' }}>kadeora.app</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: '#fff' }}>{s.name}</div>
            <div style={{ display: 'flex', fontSize: 20, color: '#666', marginLeft: 12 }}>{s.symbol}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 36 }}>
            <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: '#fff' }}>{price}</div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: chgColor, marginLeft: 16 }}>{chgText}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#888', marginBottom: 8 }}>시가총액</div>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff' }}>{cap}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#888', marginBottom: 8 }}>PER</div>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff' }}>{per}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#888', marginBottom: 8 }}>PBR</div>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff' }}>{pbr}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#888', marginBottom: 8 }}>배당률</div>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff' }}>{dy}</div>
            </div>
          </div>
        </div>,
        { width: 1200, height: 630, ...fontOpts() }
      ).arrayBuffer();
      return new Response(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
    }

    if (apt) {
      const { data: site } = await (sb as any).from('apt_sites')
        .select('name, region, sigungu, builder, total_units, price_min, price_max, move_in_date')
        .eq('slug', apt).eq('is_active', true).maybeSingle();
      if (!site) return new Response('Not found', { status: 404 });

      const pMin = site.price_min ? `${(site.price_min / 10000).toFixed(1)}억` : '-';
      const pMax = site.price_max ? `${(site.price_max / 10000).toFixed(1)}억` : '-';
      const moveIn = site.move_in_date ? `${String(site.move_in_date).slice(0, 4)}년 ${String(site.move_in_date).slice(4, 6)}월` : '미정';
      const units = site.total_units ? `${Number(site.total_units).toLocaleString()}세대` : '-';
      const builder = site.builder ? String(site.builder).slice(0, 10) : '-';

      const buf = await new ImageResponse(
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#050A18', padding: '48px 56px', fontFamily: 'NK' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', fontSize: 14, color: '#00FF87', background: 'rgba(0,255,135,0.15)', padding: '4px 14px', borderRadius: 20 }}>{site.region} {site.sigungu || ''}</div>
            <div style={{ display: 'flex', fontSize: 13, color: '#666', marginLeft: 'auto' }}>kadeora.app</div>
          </div>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{site.name}</div>
          <div style={{ display: 'flex', fontSize: 18, color: '#888', marginBottom: 32 }}>{builder} | {units} | 입주 {moveIn}</div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', background: 'rgba(0,255,135,0.08)', borderRadius: '12px', marginBottom: 24 }}>
            <div style={{ display: 'flex', fontSize: 16, color: '#00FF87', marginRight: 16 }}>분양가</div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#fff' }}>{pMin} ~ {pMax}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#888', marginBottom: 8 }}>세대수</div>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff' }}>{units}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#888', marginBottom: 8 }}>시공사</div>
              <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: '#fff' }}>{builder}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#888', marginBottom: 8 }}>입주</div>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff' }}>{moveIn}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 13, color: '#888', marginBottom: 8 }}>지역</div>
              <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: '#fff' }}>{site.region}</div>
            </div>
          </div>
        </div>,
        { width: 1200, height: 630, ...fontOpts() }
      ).arrayBuffer();
      return new Response(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
    }

    return new Response('?symbol=XXX or ?apt=slug', { status: 400 });
  } catch (e: any) {
    console.error("[og-chart]", e?.message, req.nextUrl.searchParams.toString());
    // Return 1x1 transparent PNG fallback instead of 500
    const fallback = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    return new Response(fallback, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' } });
  }
}
