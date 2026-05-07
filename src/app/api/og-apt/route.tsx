import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

let _fontCache: ArrayBuffer | null = null;
function loadFont(): ArrayBuffer | null {
  if (_fontCache) return _fontCache;
  try {
    const buf = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.woff'));
    _fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _fontCache;
  } catch { return null; }
}

const SIDE = 630;

const SITE_TYPE_LABEL: Record<string, string> = {
  subscription: '분양',
  redevelopment: '재개발',
  unsold: '미분양',
  trade: '실거래',
  landmark: '랜드마크',
  complex: '단지',
};

const LIFECYCLE_LABEL: Record<string, string> = {
  site_planning: '부지계획',
  pre_announcement: '분양예정',
  model_house_open: '견본주택',
  special_supply: '특별공급',
  subscription_open: '청약접수',
  contract: '계약',
  construction: '시공',
  pre_move_in: '입주예정',
  move_in: '입주',
  resale: '실거래',
};

function fmtAmount(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  return n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
}

interface AptRow {
  slug: string;
  name: string;
  site_type: string;
  region?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  address?: string | null;
  builder?: string | null;
  developer?: string | null;
  total_units?: number | null;
  built_year?: number | null;
  move_in_date?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  nearby_station?: string | null;
  school_district?: string | null;
  description?: string | null;
  key_features?: any;
  lifecycle_stage?: string | null;
  interest_count?: number | null;
}

async function fetchSite(slug: string): Promise<AptRow | null> {
  try {
    const sb = getSupabaseAdmin();
    const cols = 'slug,name,site_type,region,sigungu,dong,address,builder,developer,total_units,built_year,move_in_date,price_min,price_max,latitude,longitude,nearby_station,school_district,description,key_features,lifecycle_stage,interest_count';
    const { data } = await (sb as any).from('apt_sites').select(cols).eq('slug', slug).maybeSingle();
    return (data ?? null) as AptRow | null;
  } catch { return null; }
}

function bgFor(card: number, site: AptRow | null): string {
  const t = site?.site_type;
  if (card === 1) return '#1A1A18';
  if (card === 2) {
    if (t === 'subscription') return '#854F0B';
    if (t === 'redevelopment') return '#3C3489';
    if (t === 'unsold') return '#BA7517';
    return '#085041';
  }
  if (card === 3) return '#0F6E56';
  if (card === 4) return '#791F1F';
  if (card === 5) return '#0C447C';
  return '#2C2C2A';
}

function renderCover(site: AptRow): React.ReactElement {
  const region = [site.region, site.sigungu, site.dong].filter(Boolean).join(' ');
  const stLabel = SITE_TYPE_LABEL[site.site_type] || '단지';
  const lcLabel = site.lifecycle_stage ? LIFECYCLE_LABEL[site.lifecycle_stage] : null;
  const nameFS = site.name.length > 14 ? 56 : site.name.length > 10 ? 70 : 84;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ background: '#FAC775', color: '#1A1A18', fontSize: 22, fontWeight: 800, padding: '6px 16px', borderRadius: 999 }}>{stLabel}</div>
        {lcLabel && <div style={{ background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontSize: 22, fontWeight: 700, padding: '6px 16px', borderRadius: 999 }}>{lcLabel}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 56, height: 4, background: '#FAC775' }} />
        <div style={{ fontSize: nameFS, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: -2 }}>{site.name}</div>
        {region && <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.66)', fontWeight: 600 }}>{region}</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: 700 }}>
        <span>kadeora.app</span>
        <span>단지 정보</span>
      </div>
    </div>
  );
}

function renderMetric(site: AptRow): React.ReactElement {
  const t = site.site_type;
  let label = '시세';
  let value = '—';
  let sub = '';
  if (t === 'subscription') {
    label = '분양가';
    if (site.price_min && site.price_max && site.price_min !== site.price_max) value = `${fmtAmount(site.price_min)} ~ ${fmtAmount(site.price_max)}`;
    else if (site.price_min) value = fmtAmount(site.price_min);
    sub = '최고 분양가 기준';
  } else if (t === 'redevelopment') {
    label = '사업단계';
    value = site.lifecycle_stage ? LIFECYCLE_LABEL[site.lifecycle_stage] || '진행중' : '—';
    sub = '재개발·재건축';
  } else if (t === 'unsold') {
    label = '잔여세대';
    value = site.total_units ? `${site.total_units.toLocaleString()}세대` : '—';
    sub = '미분양 잔여';
  } else {
    label = '시세';
    if (site.price_max) value = fmtAmount(site.price_max);
    sub = '실거래·시세';
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>{label.toUpperCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: value.length > 10 ? 76 : 110, fontWeight: 900, color: '#FFFFFF', letterSpacing: -3, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: 700 }}>
        <span>{site.name}</span>
        <span>kadeora.app</span>
      </div>
    </div>
  );
}

function renderUnits(site: AptRow): React.ReactElement {
  const total = site.total_units;
  const features: string[] = Array.isArray(site.key_features) ? site.key_features.slice(0, 3) : [];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>UNITS · 평형</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 130, fontWeight: 900, color: '#FFFFFF', letterSpacing: -4, lineHeight: 1 }}>{total ? total.toLocaleString() : '—'}</div>
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.66)', fontWeight: 600 }}>총 세대수</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {features.length > 0
          ? features.map((f, i) => (
              <div key={i} style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'flex', gap: 8 }}>
                <span style={{ color: '#FAC775' }}>•</span>
                <span>{String(f).slice(0, 40)}</span>
              </div>
            ))
          : <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>평형별 상세는 단지 페이지 참조</div>}
      </div>
    </div>
  );
}

function renderTiming(site: AptRow): React.ReactElement {
  const t = site.site_type;
  let title = '거래동향';
  let value = '—';
  let sub = '';
  if (t === 'subscription') {
    title = '청약일정';
    value = site.lifecycle_stage ? LIFECYCLE_LABEL[site.lifecycle_stage] || '예정' : '예정';
    sub = site.move_in_date ? `입주 ${site.move_in_date}` : '일정 곧 공개';
  } else {
    title = '거래동향';
    value = site.built_year ? `${site.built_year}년` : '—';
    sub = '준공년도';
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>{title.toUpperCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: value.length > 8 ? 76 : 110, fontWeight: 900, color: '#FFFFFF', letterSpacing: -3, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: 700 }}>
        <span>{site.name}</span>
        <span>kadeora.app</span>
      </div>
    </div>
  );
}

function renderPlace(site: AptRow): React.ReactElement {
  const region = [site.region, site.sigungu].filter(Boolean).join(' ');
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>PLACE · 입지</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ width: 96, height: 96, borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '3px solid #FAC775', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📍</div>
        <div style={{ fontSize: 38, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15 }}>{region || '주소 정보'}</div>
        <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.66)', fontWeight: 600, lineHeight: 1.4 }}>{site.address || site.dong || ''}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {site.nearby_station && (
          <div style={{ fontSize: 18, color: '#FFFFFF', fontWeight: 700 }}>🚉 {site.nearby_station}</div>
        )}
        {site.school_district && (
          <div style={{ fontSize: 18, color: '#FFFFFF', fontWeight: 700 }}>🎓 {site.school_district}</div>
        )}
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginTop: 4 }}>kadeora.app</div>
      </div>
    </div>
  );
}

function renderSpec(site: AptRow): React.ReactElement {
  const cells = [
    { label: '세대수', value: site.total_units ? `${site.total_units.toLocaleString()}` : '—' },
    { label: '시공사', value: site.builder ? site.builder.slice(0, 10) : '—' },
    { label: '준공', value: site.built_year ? `${site.built_year}` : (site.move_in_date || '—') },
    { label: '관심', value: site.interest_count ? site.interest_count.toLocaleString() : '0' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>SPEC · 단지 스펙</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.16)' }}>
          <div style={{ flex: 1, padding: '20px 16px 20px 0', display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid rgba(255,255,255,0.16)' }}>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{cells[0].label}</div>
            <div style={{ fontSize: 44, color: '#FFFFFF', fontWeight: 900, letterSpacing: -1 }}>{cells[0].value}</div>
          </div>
          <div style={{ flex: 1, padding: '20px 0 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{cells[1].label}</div>
            <div style={{ fontSize: 32, color: '#FFFFFF', fontWeight: 900, letterSpacing: -1 }}>{cells[1].value}</div>
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, padding: '20px 16px 20px 0', display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid rgba(255,255,255,0.16)' }}>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{cells[2].label}</div>
            <div style={{ fontSize: 32, color: '#FFFFFF', fontWeight: 900, letterSpacing: -1 }}>{cells[2].value}</div>
          </div>
          <div style={{ flex: 1, padding: '20px 0 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{cells[3].label}</div>
            <div style={{ fontSize: 32, color: '#FAC775', fontWeight: 900, letterSpacing: -1 }}>{cells[3].value}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: 700 }}>
        <span>{site.name}</span>
        <span>kadeora.app</span>
      </div>
    </div>
  );
}

function renderFallback(slug: string | null): React.ReactElement {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between', background: '#1A1A18' }}>
      <div style={{ fontSize: 22, color: '#FAC775', fontWeight: 800 }}>카더라 · kadeora.app</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 4, background: '#FAC775' }} />
        <div style={{ fontSize: 64, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: -2 }}>단지 정보</div>
        <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.66)', fontWeight: 600 }}>{slug ? `slug=${slug}` : '대한민국 부동산 커뮤니티'}</div>
      </div>
      <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>주식·부동산 소리소문 커뮤니티</div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get('slug')?.trim().slice(0, 200) || null;
  const cardRaw = parseInt(sp.get('card') || '1', 10);
  const card = Math.min(6, Math.max(1, isNaN(cardRaw) ? 1 : cardRaw));

  const fontData = loadFont();
  const fontOpts = fontData
    ? { fonts: [{ name: 'NotoSansKR', data: fontData, style: 'normal' as const, weight: 700 as const }] }
    : {};
  const ff = fontData ? 'NotoSansKR, sans-serif' : 'sans-serif';

  let site: AptRow | null = null;
  try {
    if (slug) site = await fetchSite(slug);
  } catch (err) {
    console.error('[og-apt] fetchSite error:', err);
    site = null;
  }

  // s205-W9: body 구성 + ImageResponse 모두 단일 try 로 wrapping → 어떤 필드 throw 도 fallback 으로 다운그레이드.
  try {
    let body: React.ReactElement;
    if (!site) {
      body = renderFallback(slug);
    } else if (card === 1) {
      body = renderCover(site);
    } else if (card === 2) {
      body = renderMetric(site);
    } else if (card === 3) {
      body = renderUnits(site);
    } else if (card === 4) {
      body = renderTiming(site);
    } else if (card === 5) {
      body = renderPlace(site);
    } else {
      body = renderSpec(site);
    }

    const wrapped = (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: bgFor(card, site), fontFamily: ff }}>
        {body}
      </div>
    );


    const img = new ImageResponse(wrapped, {
      width: SIDE,
      height: SIDE,
      emoji: 'twemoji',
      ...fontOpts,
    });
    return new Response(await img.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-OG-Card': String(card),
        'X-OG-Slug': slug || 'fallback',
      },
    });
  } catch (err) {
    // s239-p1: console.error 분할 (Vercel log 1 row 길이 제한 — 단일 호출 시 stack 잘림)
    const e = err as Error;
    console.error('[og-apt] message=', e?.message);
    console.error('[og-apt] stack=', e?.stack);
    console.error('[og-apt] class=', e?.constructor?.name);
    console.error('[og-apt] code=', (err as any)?.code);
    console.error('[og-apt] input=', JSON.stringify({ slug, card, fontLoaded: !!fontData, hasSite: !!site, siteType: site?.site_type, nameLen: site?.name?.length }));
    return Response.redirect('https://kadeora.app/images/brand/kadeora-hero.png', 302);
  }
}
