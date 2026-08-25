import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { OG_CAT } from '@/lib/og-tokens';
import { SITE_URL } from '@/lib/constants';
import { sanitizeRowForOG } from '@/lib/og-sanitize';

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

/**
 * ADDENDUM §A — 비율별 규격.
 *
 * ⚠️ 정사각 카드를 가로 히어로에 그대로 넣어 **좌우가 텅 비어 있었다**(/apt/아크로-라로체 실측).
 *    목록용 1:1 을 4:3·21:9 에 재사용한 결과다.
 *    한 이미지를 늘리거나 레터박스로 채우지 않는다 — **넓으면 정보를 더 넣는다.**
 *
 *   1x1   목록 썸네일    3줄 가운데 정렬 (기존 카드 6종 그대로)
 *   4x3   히어로 모바일  좌 3줄 왼쪽정렬 · 우 세대수
 *   21x9  히어로 데스크탑 〃 여백을 세대수·단계·시공사로 채운다
 */
const RATIOS = {
  '1x1': { w: SIDE, h: SIDE },
  '4x3': { w: 1200, h: 900 },
  '21x9': { w: 1680, h: 720 },
} as const;
type RatioKey = keyof typeof RATIOS;

/**
 * §A-3 자간 — 크기 비례.
 *   36px+   -.055em
 *   20~35px -.04em
 *   그 외   -.02em
 * ⚠️ Satori 는 em 단위 letterSpacing 을 신뢰할 수 없어 px 로 환산한다.
 */
function tracking(fs: number): number {
  const ratio = fs >= 36 ? 0.055 : fs >= 20 ? 0.04 : 0.02;
  return -(fs * ratio);
}

/**
 * §A-3 굵기·외곽선. 900 Black + 그림자 3px.
 * ⚠️ `-webkit-text-stroke` 는 Satori 지원이 불확실해 그림자로 두께를 만든다.
 *    서버 렌더라 브라우저 편차가 없다는 점이 오히려 유리하다.
 */
const HEAVY = {
  fontWeight: 900 as const,
  textShadow: '0 3px 8px rgba(0,0,0,0.55), 0 1px 0 rgba(0,0,0,0.9)',
};

const SITE_TYPE_LABEL: Record<string, string> = {
  subscription: '분양',
  redevelopment: '재개발',
  unsold: '미분양',
  trade: '실거래',
  landmark: '랜드마크',
  complex: '단지',
};

// V13 A-2: 단계 라벨 단일 원본 (lib/apt/lifecycle-label.ts).
import { LIFECYCLE_LABEL } from '@/lib/apt/lifecycle-label';

function fmtAmount(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  return n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
}

interface AptRow {
  slug: string;
  name: string;
  /** ⚠️ §A-3: 표시는 이걸 우선한다. 456건에 붙어 있다. 없으면 name 으로 떨어진다. */
  display_name?: string | null;
  /** 단지 전체 / 일반분양. 히어로 우측 지표에 쓴다 — 라벨 없이 쓰지 않는다. */
  complex_units?: number | null;
  supply_units?: number | null;
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
    // ⚠️ §A: display_name·complex_units·supply_units 를 함께 읽는다.
    //    이 셋이 없으면 히어로 우측이 비고 이름이 행정 명칭으로 나간다.
    const cols = 'slug,name,display_name,site_type,region,sigungu,dong,address,builder,developer,total_units,complex_units,supply_units,built_year,move_in_date,price_min,price_max,latitude,longitude,nearby_station,school_district,description,key_features,lifecycle_stage,interest_count';
    const { data } = await (sb as any).from('apt_sites').select(cols).eq('slug', slug).maybeSingle();
    return sanitizeRowForOG(data ?? null) as AptRow | null;
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
        <div style={{ display:'flex', background: '#FAC775', color: '#1A1A18', fontSize: 22, fontWeight: 800, padding: '6px 16px', borderRadius: 999 }}>{stLabel}</div>
        {lcLabel ? <div style={{ display:'flex', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontSize: 22, fontWeight: 700, padding: '6px 16px', borderRadius: 999 }}>{lcLabel}</div> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display:'flex', width: 56, height: 4, background: '#FAC775' }} />
        <div style={{ display:'flex', fontSize: nameFS, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: -2 }}>{site.name}</div>
        {region ? <div style={{ display:'flex', fontSize: 26, color: 'rgba(255,255,255,0.66)', fontWeight: 600 }}>{region}</div> : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: 700 }}>
        <span>kadeora.app</span>
        <span>단지 정보</span>
      </div>
    </div>
  );
}

/** 표시 이름 — display_name 우선, 없으면 name. §A-3 */
const displayNameOf = (site: AptRow): string => (site.display_name || site.name || '').trim();

/**
 * §A-2 히어로 레이아웃 (4:3 · 21:9).
 *
 * 좌: [지역] · 이름 3줄 · [단계]
 * 우: 세대수 · 시공사 · 입주/착공
 *
 * ⚠️ 정사각 카드를 늘리지 않는다. 넓어진 만큼 **정보를 더 넣는다.**
 * ⚠️ 세대수는 라벨을 붙인다. 라벨 없는 '176세대' 는 총세대수로 오독된다 —
 *    complex_units 가 있으면 '총', 없고 supply_units 만 있으면 '일반분양' 이다.
 */
function renderHero(site: AptRow, ratio: RatioKey): React.ReactElement {
  const wide = ratio === '21x9';
  const name = displayNameOf(site);
  const lcLabel = site.lifecycle_stage ? LIFECYCLE_LABEL[site.lifecycle_stage] : null;

  // ⚠️ 지역 중복 제거 — display_name 이 이미 시군구를 품고 있는 경우가 많다.
  //    실측: display_name '부산진구 아크로 라로체' + 배지 '부산 부산진구' → 「부산진구」가 두 번.
  //    §B-5 에서 제목·설명에 대해 고쳤던 것과 같은 문제가 카드에서 되살아난 것이다.
  //    이름에 이미 들어 있는 조각은 배지에서 뺀다. 둘 다 들어 있으면 배지를 아예 그리지 않는다.
  const regionParts = [site.region, site.sigungu]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .filter((v) => !name.includes(v));
  const region = regionParts.join(' ');

  // 이름 길이에 따라 크기를 줄인다. 21:9 는 높이가 낮아 더 보수적으로 잡는다.
  const base = wide ? 96 : 108;
  const nameFS = name.length > 18 ? base - 34 : name.length > 12 ? base - 20 : base;

  const units =
    site.complex_units && site.complex_units > 0
      ? { label: '총세대수', value: `${site.complex_units.toLocaleString()}세대` }
      : site.supply_units && site.supply_units > 0
        ? { label: '일반분양', value: `${site.supply_units.toLocaleString()}세대` }
        : site.total_units && site.total_units > 0
          ? { label: '세대수', value: `${site.total_units.toLocaleString()}세대` }
          : null;

  const stats: { label: string; value: string }[] = [];
  if (units) stats.push(units);
  if (site.builder) stats.push({ label: '시공사', value: String(site.builder).slice(0, 18) });
  if (site.move_in_date) stats.push({ label: '입주', value: String(site.move_in_date).slice(0, 10) });
  else if (lcLabel) stats.push({ label: '진행', value: lcLabel });

  const pad = wide ? 72 : 64;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', padding: pad, gap: wide ? 56 : 40 }}>
      {/* 좌 — 이름 블록 */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: 18 }}>
        {region ? (
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', background: '#FAC775', color: '#1A1A18', fontSize: 26, fontWeight: 800, padding: '7px 20px', borderRadius: 999, letterSpacing: tracking(26) }}>
              {region}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', width: 72, height: 6, background: '#FAC775' }} />

        <div
          style={{
            display: 'flex',
            fontSize: nameFS,
            color: '#FFFFFF',
            lineHeight: 1.08,
            letterSpacing: tracking(nameFS),
            ...HEAVY,
          }}
        >
          {name}
        </div>

        {lcLabel ? (
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.14)', color: '#FFFFFF', fontSize: 26, fontWeight: 800, padding: '7px 20px', borderRadius: 999, letterSpacing: tracking(26) }}>
              {lcLabel}
            </div>
          </div>
        ) : null}
      </div>

      {/* 우 — 지표. ⚠️ 비어 있으면 아예 그리지 않는다. 빈 칸이 남는 게 지금 문제다 */}
      {stats.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: wide ? 30 : 26,
            minWidth: wide ? 420 : 340,
            borderLeft: '3px solid rgba(255,255,255,0.18)',
            paddingLeft: wide ? 56 : 40,
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.62)', fontWeight: 700, letterSpacing: tracking(22) }}>
                {s.label}
              </div>
              <div style={{ display: 'flex', fontSize: 46, color: '#FFFFFF', letterSpacing: tracking(46), ...HEAVY }}>
                {s.value}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: tracking(20) }}>
            kadeora.app
          </div>
        </div>
      ) : null}
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
      <div style={{ display:'flex', fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>{label.toUpperCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display:'flex', fontSize: value.length > 10 ? 76 : 110, fontWeight: 900, color: '#FFFFFF', letterSpacing: -3, lineHeight: 1 }}>{value}</div>
        <div style={{ display:'flex', fontSize: 24, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{sub}</div>
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
      <div style={{ display:'flex', fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>UNITS · 평형</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display:'flex', fontSize: 130, fontWeight: 900, color: '#FFFFFF', letterSpacing: -4, lineHeight: 1 }}>{total ? total.toLocaleString() : '—'}</div>
        <div style={{ display:'flex', fontSize: 28, color: 'rgba(255,255,255,0.66)', fontWeight: 600 }}>총 세대수</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {features.length > 0
          ? features.map((f, i) => (
              <div key={i} style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'flex', gap: 8 }}>
                <span style={{ color: '#FAC775' }}>•</span>
                <span>{String(f).slice(0, 40)}</span>
              </div>
            ))
          : <div style={{ display:'flex', fontSize: 18, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>평형별 상세는 단지 페이지 참조</div>}
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
      <div style={{ display:'flex', fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>{title.toUpperCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display:'flex', fontSize: value.length > 8 ? 76 : 110, fontWeight: 900, color: '#FFFFFF', letterSpacing: -3, lineHeight: 1 }}>{value}</div>
        <div style={{ display:'flex', fontSize: 24, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{sub}</div>
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
      <div style={{ display:'flex', fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>PLACE · 입지</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* s270: 글리프 ● 제거 — NotoSansKR 서브셋에 U+25CF 없음 → satori dynamic font fetch 400 (7일 5,758회). 순수 CSS 원으로 대체 (Rule #47 확장: 도형도 글리프 대신 CSS) */}
        <div style={{ width: 96, height: 96, borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '3px solid #FAC775', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: '#FAC775', display: 'flex' }} />
        </div>
        <div style={{ display:'flex', fontSize: 38, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15 }}>{region || '주소 정보'}</div>
        <div style={{ display:'flex', fontSize: 22, color: 'rgba(255,255,255,0.66)', fontWeight: 600, lineHeight: 1.4 }}>{site.address || site.dong || ''}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {site.nearby_station ? (
          <div style={{ display: 'flex', fontSize: 18, color: '#FFFFFF', fontWeight: 700 }}>역 {site.nearby_station}</div>
        ) : null}
        {site.school_district ? (
          <div style={{ display: 'flex', fontSize: 18, color: '#FFFFFF', fontWeight: 700 }}>학교 {site.school_district}</div>
        ) : null}
        <div style={{ display:'flex', fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginTop: 4 }}>kadeora.app</div>
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
      <div style={{ display:'flex', fontSize: 24, color: 'rgba(255,255,255,0.66)', fontWeight: 700, letterSpacing: 2 }}>SPEC · 단지 스펙</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.16)' }}>
          <div style={{ flex: 1, padding: '20px 16px 20px 0', display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid rgba(255,255,255,0.16)' }}>
            <div style={{ display:'flex', fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{cells[0].label}</div>
            <div style={{ display:'flex', fontSize: 44, color: '#FFFFFF', fontWeight: 900, letterSpacing: -1 }}>{cells[0].value}</div>
          </div>
          <div style={{ flex: 1, padding: '20px 0 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display:'flex', fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{cells[1].label}</div>
            <div style={{ display:'flex', fontSize: 32, color: '#FFFFFF', fontWeight: 900, letterSpacing: -1 }}>{cells[1].value}</div>
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, padding: '20px 16px 20px 0', display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid rgba(255,255,255,0.16)' }}>
            <div style={{ display:'flex', fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{cells[2].label}</div>
            <div style={{ display:'flex', fontSize: 32, color: '#FFFFFF', fontWeight: 900, letterSpacing: -1 }}>{cells[2].value}</div>
          </div>
          <div style={{ flex: 1, padding: '20px 0 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display:'flex', fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{cells[3].label}</div>
            <div style={{ display:'flex', fontSize: 32, color: '#FAC775', fontWeight: 900, letterSpacing: -1 }}>{cells[3].value}</div>
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

/**
 * 폴백 — 현장을 못 찾았을 때.
 *
 * ⚠️ 이것도 비율을 봐야 한다. 세로 배치를 21:9 에 그대로 쓰면 **오른쪽 3분의 2가 텅 빈다** —
 *    §A 가 지적한 화면이 정확히 이 모습이었다(DB 조회 실패 시에도 같은 그림이 나간다).
 *    가로에서는 좌우로 갈라 균형을 맞춘다.
 */
function renderFallback(slug: string | null, ratio: RatioKey = '1x1'): React.ReactElement {
  const aptLabel = OG_CAT.apt.label;
  const wide = ratio !== '1x1';
  const titleFS = wide ? 88 : 64;

  const left = (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: 16 }}>
      <div style={{ display: 'flex', width: wide ? 72 : 56, height: wide ? 6 : 4, background: '#FAC775' }} />
      <div style={{ display: 'flex', fontSize: titleFS, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: tracking(titleFS), ...HEAVY }}>
        단지 정보
      </div>
      <div style={{ display: 'flex', fontSize: wide ? 26 : 22, color: 'rgba(255,255,255,0.66)', fontWeight: 600 }}>
        {slug ? `slug=${slug}` : `대한민국 ${aptLabel} 커뮤니티`}
      </div>
    </div>
  );

  if (!wide) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between', background: '#1A1A18' }}>
        <div style={{ display: 'flex', fontSize: 22, color: '#FAC775', fontWeight: 800 }}>카더라 · kadeora.app</div>
        {left}
        <div style={{ display: 'flex', fontSize: 18, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>주식·부동산 소리소문 커뮤니티</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', padding: 72, gap: 56, background: '#1A1A18' }}>
      {left}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 14,
          minWidth: 420,
          borderLeft: '3px solid rgba(255,255,255,0.18)',
          paddingLeft: 56,
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#FAC775', fontWeight: 800, letterSpacing: tracking(30) }}>
          카더라 · kadeora.app
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
          주식·부동산 소리소문 커뮤니티
        </div>
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get('slug')?.trim().slice(0, 200) || null;
  const cardRaw = parseInt(sp.get('card') || '1', 10);
  const card = Math.min(6, Math.max(1, isNaN(cardRaw) ? 1 : cardRaw));

  // §A-2 — 비율. 모르는 값은 1x1 로 떨어진다(기존 호출부가 그대로 동작해야 한다).
  const ratioRaw = (sp.get('ratio') || '1x1').trim();
  const ratio: RatioKey = ratioRaw in RATIOS ? (ratioRaw as RatioKey) : '1x1';
  const { w, h } = RATIOS[ratio];

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
      body = renderFallback(slug, ratio);
    } else if (ratio !== '1x1') {
      // ⚠️ 가로 비율은 카드 6종을 쓰지 않는다. 정사각 레이아웃을 늘리면 좌우가 빈다.
      body = renderHero(site, ratio);
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
      width: w,
      height: h,
      ...fontOpts,
    });
    return new Response(await img.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-OG-Card': String(card),
        // 헤더는 ByteString(0-255)만 허용 — 한글 슬러그 직접 삽입 시 throw → fallback. ASCII 화.
        'X-OG-Slug': encodeURIComponent(slug || 'fallback'),
      },
    });
  } catch (err) {
    // s270: 분할 로그 5행 → 3행 통합 — 분할 출력이 Vercel 에러 그룹을 파편화하던 문제 (행당 300자는 4KB 제한 내 안전)
    const e = err as Error;
    console.error(`[og-apt] cls=${e?.constructor?.name} code=${(err as any)?.code ?? 'n/a'} msg=${(e?.message ?? '').slice(0, 300)}`);
    if (e?.stack) console.error(`[og-apt] stack=${e.stack.slice(0, 300)}`);
    console.error('[og-apt] input=', JSON.stringify({ slug, card, fontLoaded: !!fontData, hasSite: !!site, siteType: site?.site_type, nameLen: site?.name?.length }));
    // s263 Phase 2.1++: redirect 302 제거. simple ImageResponse fallback.
    try {
      const fbImg = new ImageResponse(
        (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0F1B3E', color: '#fff', fontFamily: 'sans-serif' }}>
            <div style={{ display:'flex', fontSize: 28, color: '#FBBF24', letterSpacing: 4, marginBottom: 16, fontWeight: 900 }}>KADEORA</div>
            <div style={{ display:'flex', fontSize: 56, fontWeight: 900, letterSpacing: -1 }}>apt</div>
          </div>
        ),
        { width: SIDE, height: SIDE },
      );
      return new Response(await fbImg.arrayBuffer(), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900', 'X-OG-Fallback': '1' },
      });
    } catch {
      return Response.redirect(`${SITE_URL}/images/brand/kadeora-hero.png`, 302);
    }
  }
}
