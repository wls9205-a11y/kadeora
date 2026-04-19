import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

/**
 * BlogMentionCard — 블로그 글의 tags + category 기반으로
 * 언급된 종목/단지를 감지하여 하위 페이지로 유도하는 카드.
 *
 * v3 (세션 114):
 * - placement='top' | 'bottom' 두 디자인 지원
 * - 상단: 152px 넓은 카드 + 스파크라인 차트(주식) + 88px 썸네일(부동산) + 태그 배지
 * - 하단: 기존 컴팩트 카드 유지 (완독 유저 전환용)
 * - 상단 주식은 stock_price_history 30일 데이터로 스파크라인 렌더
 */

interface Props {
  tags: string[];
  category: string;
  sourceRef?: string | null;
  title?: string;
  placement?: 'top' | 'bottom';
}

// ─── 한국 시도 목록 ───
const SIDO_LIST = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const SIGUNGU_RE = /^.{1,5}(시|군|구)$/;

function extractRegion(tags: string[], title: string = ''): string | null {
  const haystack = [title, ...(tags || [])].join(' ');
  for (const sido of SIDO_LIST) {
    if (haystack.includes(sido)) return sido;
  }
  return null;
}

function extractSigungu(tags: string[], title: string = ''): string | null {
  for (const t of tags || []) {
    if (t && SIGUNGU_RE.test(t)) return t;
  }
  const words = (title || '').split(/[\s—·|(),]/);
  for (const w of words) {
    if (w && SIGUNGU_RE.test(w)) return w;
  }
  return null;
}

function extractComplexName(title: string): string | null {
  if (!title) return null;
  const first = title.trim().split(/[\s—·|(),]/)[0];
  if (!first || first.length < 2) return null;
  if (/^\d+$/.test(first) || /^\(/.test(first)) return null;
  if (SIDO_LIST.includes(first)) return null;
  if (SIGUNGU_RE.test(first)) return null;
  if (['중국', '미국', '일본', '글로벌', '부동산', '주식', '아파트', '분양'].includes(first)) return null;
  return first;
}

const GENERIC_TAGS = new Set([
  '주식', 'KOSPI', 'KOSDAQ', 'KRX', '투자', '시세', '주가', '분석', '주가분석',
  '청약', '분양', '아파트', '신축', '미분양', '재개발', '재건축',
  '지주', '증권', '지수', '종목', '부동산', '매매', '전세', '월세',
  '실거래', '실거래가', '매물', '거래', '뉴스', '전망', '시장',
  '리포트', '투자분석', '단지분석', '시세현황', '대장', '대장주',
]);

function isUsefulTag(t: string): boolean {
  if (!t || t.length < 2) return false;
  if (GENERIC_TAGS.has(t)) return false;
  if (SIDO_LIST.includes(t)) return false;
  if (SIGUNGU_RE.test(t)) return false;
  return true;
}

// ─── 주식 매칭 ───
async function fetchStockMentions(tags: string[], sourceRef?: string | null) {
  try {
    const sb = await createSupabaseServer();
    const allTags = [...(tags || [])].filter(Boolean);

    if (sourceRef && /^[A-Z0-9]{2,10}$/.test(sourceRef)) {
      allTags.unshift(sourceRef);
    }

    if (!allTags.length) return [];

    const [bySymbolRes, byNameRes] = await Promise.all([
      sb
        .from('stock_quotes')
        .select('symbol, name, price, change_pct, change_amt, market, sector, per, dividend_yield, market_cap')
        .in('symbol', allTags)
        .eq('is_active', true)
        .gt('price', 0)
        .limit(8),
      sb
        .from('stock_quotes')
        .select('symbol, name, price, change_pct, change_amt, market, sector, per, dividend_yield, market_cap')
        .in('name', allTags)
        .eq('is_active', true)
        .gt('price', 0)
        .limit(8),
    ]);

    if (bySymbolRes.error) console.error('[BlogMentionCard] stock bySymbol error:', bySymbolRes.error.message);
    if (byNameRes.error) console.error('[BlogMentionCard] stock byName error:', byNameRes.error.message);

    const map = new Map<string, any>();
    for (const s of [...(bySymbolRes.data || []), ...(byNameRes.data || [])] as any[]) {
      if (!map.has(s.symbol)) map.set(s.symbol, s);
    }
    const matched = [...map.values()];

    if (matched.length < 2 && matched.length > 0) {
      const seed = matched[0];
      const existingSymbols = new Set(matched.map(m => m.symbol));

      try {
        let q = sb
          .from('stock_quotes')
          .select('symbol, name, price, change_pct, change_amt, market, sector, per, dividend_yield, market_cap')
          .eq('is_active', true)
          .gt('price', 0)
          .order('market_cap', { ascending: false, nullsFirst: false })
          .limit(8);

        if (seed.sector) q = q.eq('sector', seed.sector);
        else if (seed.market) q = q.eq('market', seed.market);

        const { data: fallback } = await q;
        for (const s of (fallback || []) as any[]) {
          if (matched.length >= 6) break;
          if (!existingSymbols.has(s.symbol) && !map.has(s.symbol)) {
            map.set(s.symbol, s);
            matched.push(s);
          }
        }
      } catch (e) {
        console.error('[BlogMentionCard] stock sector fallback error:', e);
      }
    }

    return matched.slice(0, 6);
  } catch (e) {
    console.error('[BlogMentionCard] fetchStockMentions fatal:', e);
    return [];
  }
}

// ─── 스파크라인 데이터 (상단 카드 전용) ───
async function fetchSparklines(symbols: string[]): Promise<Record<string, number[]>> {
  if (!symbols.length) return {};
  try {
    const sb = await createSupabaseServer();
    const { data } = await (sb as any)
      .from('stock_price_history')
      .select('symbol, date, close_price')
      .in('symbol', symbols)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order('date', { ascending: true });

    const bySymbol: Record<string, number[]> = {};
    for (const row of (data || []) as any[]) {
      if (!bySymbol[row.symbol]) bySymbol[row.symbol] = [];
      bySymbol[row.symbol].push(Number(row.close_price));
    }
    return bySymbol;
  } catch (e) {
    console.error('[BlogMentionCard] fetchSparklines error:', e);
    return {};
  }
}

// ─── 부동산 매칭 ───
async function fetchAptMentions(
  tags: string[],
  region: string | null,
  sigungu: string | null,
  complexName: string | null,
) {
  try {
    if (!tags?.length && !complexName) return [];
    const sb = await createSupabaseServer();

    const usefulTags = (tags || []).filter(isUsefulTag).slice(0, 8);
    const results: any[] = [];
    const seenKeys = new Set<string>();

    const SELECT_COLS = 'id, slug, name, region, sigungu, address, total_units, move_in_date, built_year, images, price_min, price_max';

    const addResults = (data: any[] | null) => {
      if (!data) return;
      for (const d of data) {
        const key = `site-${d.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        results.push({ ...d, _source: 'site' });
      }
    };

    if (complexName && sigungu) {
      const { data, error } = await (sb as any)
        .from('apt_sites').select(SELECT_COLS)
        .ilike('name', `%${complexName}%`).eq('sigungu', sigungu).limit(6);
      if (error) console.error('[BlogMentionCard] apt stage1 error:', error.message);
      addResults(data);
    }

    if (results.length < 2 && complexName && region) {
      const { data } = await (sb as any)
        .from('apt_sites').select(SELECT_COLS)
        .ilike('name', `%${complexName}%`).eq('region', region).limit(6);
      addResults(data);
    }

    if (results.length < 2 && complexName) {
      const { data } = await (sb as any)
        .from('apt_sites').select(SELECT_COLS)
        .ilike('name', `%${complexName}%`).limit(6);
      addResults(data);
    }

    if (results.length < 2 && usefulTags.length) {
      for (const tag of usefulTags) {
        let q = (sb as any)
          .from('apt_sites').select(SELECT_COLS)
          .ilike('name', `%${tag}%`).limit(4);
        if (sigungu) q = q.eq('sigungu', sigungu);
        else if (region) q = q.eq('region', region);
        const { data, error } = await q;
        if (error) { console.error('[BlogMentionCard] apt stage4 error:', error.message); continue; }
        addResults(data);
        if (results.length >= 6) break;
      }
    }

    if (results.length === 0 && usefulTags.length) {
      for (const tag of usefulTags) {
        const { data } = await (sb as any)
          .from('apt_sites').select(SELECT_COLS)
          .ilike('name', `%${tag}%`).limit(3);
        addResults(data);
        if (results.length >= 6) break;
      }
    }

    // 6단계 (변경): 단지백과 매칭 - 이미지 있는 것 먼저
    if (results.length < 3) {
      const complexTerms = ([complexName, ...usefulTags].filter(Boolean) as string[]).slice(0, 4);
      const fetchComplexByTag = async (tag: string) => {
        let q = (sb as any)
          .from('apt_complex_profiles')
          .select('id, apt_name, region_nm, sigungu, dong, total_households, built_year, images, latest_sale_price, sale_count_1y')
          .ilike('apt_name', `%${tag}%`).limit(15); // 많이 가져와서 JS-side 필터
        if (sigungu) q = q.eq('sigungu', sigungu);
        else if (region) q = q.ilike('region_nm', `%${region}%`);
        const { data, error } = await q;
        if (error) { console.error('[BlogMentionCard] apt_complex_profiles error:', error.message); return []; }
        return (data || []) as any[];
      };

      const allComplex: any[] = [];
      for (const tag of complexTerms) {
        const r = await fetchComplexByTag(tag);
        for (const item of r) {
          if (!allComplex.find(x => x.id === item.id)) allComplex.push(item);
        }
        if (allComplex.length >= 30) break;
      }

      // JS-side: 이미지 있는 것 먼저
      const hasImg = (c: any) => Array.isArray(c.images) && c.images.length > 0
        && (typeof c.images[0] === 'string' ? c.images[0] : c.images[0]?.url);
      const sorted = [
        ...allComplex.filter(hasImg),
        ...allComplex.filter(c => !hasImg(c)),
      ];

      for (const d of sorted) {
        const key = `complex-${d.apt_name}-${d.sigungu || ''}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        results.push({
          id: d.id, slug: null, name: d.apt_name, region: d.region_nm,
          sigungu: d.sigungu, address: d.dong, total_units: d.total_households,
          move_in_date: d.built_year ? `${d.built_year}` : null,
          built_year: d.built_year, images: d.images,
          price_min: null, price_max: null, latest_sale_price: d.latest_sale_price,
          _source: 'complex',
        });
        if (results.length >= 6) break;
      }
    }

    // 7단계 (변경): 같은 시군구 인기 단지 - 이미지 있는 것 먼저
    if (results.length >= 1 && results.length < 6 && sigungu) {
      // 한 번에 30건 가져온 뒤 JS-side에서 이미지 있는 것 먼저 정렬
      const { data } = await (sb as any)
        .from('apt_complex_profiles')
        .select('id, apt_name, region_nm, sigungu, dong, total_households, built_year, images, latest_sale_price, sale_count_1y')
        .eq('sigungu', sigungu).not('sale_count_1y', 'is', null)
        .order('sale_count_1y', { ascending: false }).limit(30);

      const all = (data || []) as any[];
      const hasImg = (c: any) => Array.isArray(c.images) && c.images.length > 0
        && (typeof c.images[0] === 'string' ? c.images[0] : c.images[0]?.url);
      // 이미지 있는 것 먼저, 그 다음 이미지 없는 것 (각 그룹 내에서는 sale_count_1y 순서 유지)
      const sorted = [
        ...all.filter(hasImg),
        ...all.filter(c => !hasImg(c)),
      ];

      for (const d of sorted) {
        const key = `complex-${d.apt_name}-${d.sigungu || ''}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        results.push({
          id: d.id, slug: null, name: d.apt_name, region: d.region_nm,
          sigungu: d.sigungu, address: d.dong, total_units: d.total_households,
          move_in_date: d.built_year ? `${d.built_year}` : null,
          built_year: d.built_year, images: d.images,
          price_min: null, price_max: null, latest_sale_price: d.latest_sale_price,
          _source: 'complex',
        });
        if (results.length >= 6) break;
      }
    }

    return results.slice(0, 6);
  } catch (e) {
    console.error('[BlogMentionCard] fetchAptMentions fatal:', e);
    return [];
  }
}

// ─── 포맷터 ───
function fmtAptPriceRange(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const v = max || min || 0;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}억~`;
  if (v > 0) return `${v.toLocaleString()}만~`;
  return null;
}

function fmtComplexPrice(v: number | null): string | null {
  if (!v) return null;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${v.toLocaleString()}만`;
}

function fmtStockPrice(v: number, market: string): string {
  if (['NYSE', 'NASDAQ'].includes(market)) return `$${v.toLocaleString('en', { maximumFractionDigits: 2 })}`;
  return v.toLocaleString() + '원';
}

function fmtChangeAmt(v: number, market: string): string {
  const abs = Math.abs(v);
  if (['NYSE', 'NASDAQ'].includes(market)) {
    return `${v >= 0 ? '+' : '−'}${abs.toFixed(2)}`;
  }
  return `${v >= 0 ? '+' : '−'}${abs.toLocaleString()}`;
}

// 스파크라인 SVG path 생성
function buildSparklinePath(prices: number[], width = 120, height = 32): { line: string; area: string } | null {
  if (!prices || prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const stepX = width / (prices.length - 1);

  const points = prices.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = points.join(' ');
  const area = `${line} ${width},${height} 0,${height}`;
  return { line, area };
}

// ─── 부동산 폴백 디자인 ───
// 6개 브랜드 팔레트 (모두 그린/틸 계열로 통일감 유지)
const APT_PALETTES = [
  { from: '#E1F5EE', to: '#9FE1CB', accent: '#0F6E56', initialColor: 'rgba(15,110,86,0.45)' },
  { from: '#E0F2F1', to: '#80CBC4', accent: '#00695C', initialColor: 'rgba(0,105,92,0.45)' },
  { from: '#E8F5E9', to: '#A5D6A7', accent: '#2E7D32', initialColor: 'rgba(46,125,50,0.45)' },
  { from: '#F1F8E9', to: '#C5E1A5', accent: '#558B2F', initialColor: 'rgba(85,139,47,0.45)' },
  { from: '#E0F7FA', to: '#80DEEA', accent: '#00838F', initialColor: 'rgba(0,131,143,0.45)' },
  { from: '#F0F4C3', to: '#DCE775', accent: '#827717', initialColor: 'rgba(130,119,23,0.45)' },
];
// 시드 단지 전용 팔레트 (가장 진한 그린)
const SEED_PALETTE = { from: '#9FE1CB', to: '#5DCAA5', accent: '#04342C', initialColor: 'rgba(4,52,44,0.55)' };

// 단지명 → 결정론적 hash (같은 단지 = 항상 같은 색)
function aptColorHash(name: string): number {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % APT_PALETTES.length;
}

// 단지명 첫 글자 추출 (한글/영문/숫자 우선, 괄호/공백 스킵)
function aptInitial(name: string): string {
  if (!name) return '?';
  const cleaned = name.replace(/^[^가-힣A-Za-z0-9]+/, '').trim();
  if (!cleaned) return '?';
  return cleaned.charAt(0).toUpperCase();
}

// 폴백 썸네일 컴포넌트
function FallbackThumb({ name, height, isSeed }: { name: string; height: number; isSeed?: boolean }) {
  const palette = isSeed ? SEED_PALETTE : APT_PALETTES[aptColorHash(name)];
  const initial = aptInitial(name);
  const initialFontSize = Math.round(height * 0.42);

  return (
    <div style={{
      width: '100%', height, position: 'relative',
      background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
      overflow: 'hidden',
    }}>
      {/* 건물 실루엣 SVG (오른쪽 하단, 반투명) */}
      <svg
        width={height * 0.55} height={height * 0.55}
        viewBox="0 0 24 24"
        style={{ position: 'absolute', bottom: 4, right: 6, opacity: 0.18 }}
        fill={palette.accent}
        aria-hidden
      >
        <rect x="2" y="9" width="5" height="14" rx="0.5" />
        <rect x="2.5" y="11" width="1" height="1.2" fill={palette.from} />
        <rect x="4.5" y="11" width="1" height="1.2" fill={palette.from} />
        <rect x="2.5" y="14" width="1" height="1.2" fill={palette.from} />
        <rect x="4.5" y="14" width="1" height="1.2" fill={palette.from} />
        <rect x="2.5" y="17" width="1" height="1.2" fill={palette.from} />
        <rect x="4.5" y="17" width="1" height="1.2" fill={palette.from} />
        <rect x="9" y="3" width="6" height="20" rx="0.5" />
        <rect x="9.7" y="5" width="1.2" height="1.4" fill={palette.from} />
        <rect x="12.2" y="5" width="1.2" height="1.4" fill={palette.from} />
        <rect x="9.7" y="8" width="1.2" height="1.4" fill={palette.from} />
        <rect x="12.2" y="8" width="1.2" height="1.4" fill={palette.from} />
        <rect x="9.7" y="11" width="1.2" height="1.4" fill={palette.from} />
        <rect x="12.2" y="11" width="1.2" height="1.4" fill={palette.from} />
        <rect x="9.7" y="14" width="1.2" height="1.4" fill={palette.from} />
        <rect x="12.2" y="14" width="1.2" height="1.4" fill={palette.from} />
        <rect x="9.7" y="17" width="1.2" height="1.4" fill={palette.from} />
        <rect x="12.2" y="17" width="1.2" height="1.4" fill={palette.from} />
        <rect x="17" y="11" width="5" height="12" rx="0.5" />
        <rect x="17.5" y="13" width="1" height="1.2" fill={palette.from} />
        <rect x="19.5" y="13" width="1" height="1.2" fill={palette.from} />
        <rect x="17.5" y="16" width="1" height="1.2" fill={palette.from} />
        <rect x="19.5" y="16" width="1" height="1.2" fill={palette.from} />
      </svg>
      {/* 단지명 이니셜 (중앙) */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: initialFontSize, fontWeight: 700,
        color: palette.initialColor,
        letterSpacing: '-1px', userSelect: 'none',
      }}>
        {initial}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════
export default async function BlogMentionCard({ tags, category, sourceRef, title, placement = 'bottom' }: Props) {
  const isStock = category === 'stock';
  const isApt = ['apt', 'unsold', 'redev', 'subscription'].includes(category);

  if (!isStock && !isApt) return null;
  if (!tags?.length) return null;

  // ─────── 주식 ───────
  if (isStock) {
    const stocks = await fetchStockMentions(tags, sourceRef);
    if (stocks.length < 2) return null;

    // 상단 배치: 스파크라인 데이터도 함께 fetch
    let sparklines: Record<string, number[]> = {};
    if (placement === 'top') {
      sparklines = await fetchSparklines(stocks.map((s: any) => s.symbol));
    }

    return placement === 'top'
      ? renderStockTop(stocks, sparklines)
      : renderStockBottom(stocks);
  }

  // ─────── 부동산 ───────
  const region = extractRegion(tags, title);
  const sigungu = extractSigungu(tags, title);
  const complexName = extractComplexName(title || '');
  const apts = await fetchAptMentions(tags, region, sigungu, complexName);
  if (apts.length < 2) return null;

  return placement === 'top'
    ? renderAptTop(apts, region, sigungu)
    : renderAptBottom(apts, region, sigungu);
}

// ═══════════════════════════════════════════════════════
// UI 렌더러
// ═══════════════════════════════════════════════════════

// ─── 주식 상단 (풍부 버전) ───
function renderStockTop(stocks: any[], sparklines: Record<string, number[]>) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', margin: '0 0 20px',
      border: '0.5px solid var(--border)',
      background: 'var(--bg-surface, var(--bg-secondary))',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '11px 14px 10px', borderBottom: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 3, height: 15, borderRadius: 2, background: '#378ADD' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>관련 종목</span>
        {stocks[0]?.sector && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {stocks[0].sector} 섹터</span>}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#378ADD', display: 'inline-block', animation: 'bmcPulse 2s ease-in-out infinite' }} />
          LIVE · {stocks.length}종목
        </span>
      </div>

      {/* 가로 스크롤 */}
      <div style={{ display: 'flex', gap: 8, padding: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {stocks.map((s: any, idx: number) => {
          const pct = Number(s.change_pct ?? 0);
          const isUp = pct >= 0;
          const isSeed = idx === 0;
          const prices = sparklines[s.symbol] || [];
          const spark = buildSparklinePath(prices, 120, 32);
          const lineColor = isUp ? '#A32D2D' : '#185FA5';
          const areaColor = isUp ? 'rgba(163,45,45,0.08)' : 'rgba(24,95,165,0.08)';

          return (
            <Link
              key={s.symbol}
              href={`/stock/${s.symbol}`}
              style={{
                flexShrink: 0, width: 152, borderRadius: 10, overflow: 'hidden',
                border: `0.5px solid ${isSeed ? '#85B7EB' : 'var(--border)'}`,
                textDecoration: 'none', color: 'inherit',
                background: 'var(--bg-surface, var(--bg-secondary))',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* 스파크라인 영역 */}
              <div style={{
                height: 52, position: 'relative', padding: '6px 10px 0',
                background: isUp
                  ? 'linear-gradient(180deg, rgba(163,45,45,0.06) 0%, transparent 100%)'
                  : 'linear-gradient(180deg, rgba(24,95,165,0.06) 0%, transparent 100%)',
              }}>
                <span style={{
                  position: 'absolute', top: 7, right: 8,
                  fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                  color: '#fff', background: isUp ? '#A32D2D' : '#185FA5',
                }}>
                  {isUp ? '+' : ''}{pct.toFixed(2)}%
                </span>
                {spark ? (
                  <svg width="100%" height="32" viewBox="0 0 120 32" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <polygon points={spark.area} fill={areaColor} />
                    <polyline points={spark.line} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                ) : (
                  <div style={{
                    width: '100%', height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 700, color: isUp ? 'rgba(163,45,45,0.25)' : 'rgba(24,95,165,0.25)',
                  }}>
                    {isUp ? '↗' : '↘'}
                  </div>
                )}
              </div>

              {/* 정보 영역 */}
              <div style={{
                padding: '8px 10px 10px', flex: 1,
                display: 'flex', flexDirection: 'column', gap: 3,
                background: isSeed ? 'rgba(230,241,251,0.5)' : 'transparent',
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: isSeed ? '#042C53' : 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 9, color: isSeed ? '#185FA5' : 'var(--text-tertiary)' }}>
                  {s.symbol} · {s.market}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isSeed ? '#042C53' : 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                    {fmtStockPrice(Number(s.price), s.market)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isUp ? '#A32D2D' : '#185FA5' }}>
                    {fmtChangeAmt(Number(s.change_amt || 0), s.market)}
                  </span>
                </div>
                {(Number(s.per) > 0 || Number(s.dividend_yield) > 0) && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                    {Number(s.per) > 0 && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover, var(--bg-secondary))', color: 'var(--text-secondary)' }}>
                        PER {Number(s.per).toFixed(1)}
                      </span>
                    )}
                    {Number(s.dividend_yield) > 0 && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover, var(--bg-secondary))', color: 'var(--text-secondary)' }}>
                        배당 {Number(s.dividend_yield).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 푸터 */}
      <div style={{
        padding: '8px 14px 10px', borderTop: '0.5px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Link href={`/stock/compare?a=${stocks[0]?.symbol || ''}`} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          종목 비교 →
        </Link>
        <Link href={`/stock/${stocks[0]?.symbol || ''}`} style={{
          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
          background: '#185FA5', color: '#fff', textDecoration: 'none',
        }}>
          AI 분석 보기
        </Link>
      </div>

      {/* LIVE 애니메이션 */}
      <style>{`
        @keyframes bmcPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

// ─── 주식 하단 (기존 컴팩트) ───
function renderStockBottom(stocks: any[]) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', margin: '16px 0',
      border: '0.5px solid var(--border)',
      background: 'var(--bg-surface, var(--bg-secondary))',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '9px 12px 8px', fontSize: 12, fontWeight: 600,
        color: 'var(--text-primary)',
        borderBottom: '0.5px solid var(--border)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', display: 'inline-block', flexShrink: 0 }} />
        이 글과 관련된 종목
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {stocks.map((s: any) => {
          const pct = Number(s.change_pct ?? 0);
          const isUp = pct >= 0;
          return (
            <Link
              key={s.symbol}
              href={`/stock/${s.symbol}`}
              style={{
                flexShrink: 0, width: 142, borderRadius: 10, overflow: 'hidden',
                border: '0.5px solid var(--border)', textDecoration: 'none', color: 'inherit',
                background: 'var(--bg-surface, var(--bg-secondary))', display: 'block',
                position: 'relative',
              }}
            >
              <div style={{
                width: '100%', height: 48,
                background: isUp
                  ? 'linear-gradient(180deg, rgba(5,150,105,0.08) 0%, transparent 100%)'
                  : 'linear-gradient(180deg, rgba(220,38,38,0.08) 0%, transparent 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: isUp ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)',
              }}>
                {isUp ? '↗' : '↘'}
              </div>
              <span style={{
                position: 'absolute', top: 6, right: 6,
                fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                color: '#fff', background: isUp ? 'rgba(5,150,105,0.85)' : 'rgba(220,38,38,0.85)',
              }}>
                {isUp ? '+' : ''}{pct.toFixed(1)}%
              </span>
              <div style={{ padding: '8px 8px 7px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {s.symbol} · {s.market}{s.sector ? ` · ${s.sector}` : ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fmtStockPrice(Number(s.price), s.market)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                  {Number(s.per) > 0 && (
                    <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover, var(--bg-secondary))', color: 'var(--text-secondary)' }}>
                      PER {Number(s.per).toFixed(1)}
                    </span>
                  )}
                  {Number(s.dividend_yield) > 0 && (
                    <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover, var(--bg-secondary))', color: 'var(--text-secondary)' }}>
                      배당 {Number(s.dividend_yield).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div style={{
        padding: '7px 12px 8px', borderTop: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href={`/stock/compare?a=${stocks[0]?.symbol || ''}`} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          종목 비교 →
        </Link>
        <Link href={`/stock/${stocks[0]?.symbol || ''}`} style={{
          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
          background: '#2563EB', color: '#fff', textDecoration: 'none',
        }}>
          AI 분석 보기
        </Link>
      </div>
    </div>
  );
}

// ─── 부동산 상단 (풍부 버전) ───
function renderAptTop(apts: any[], region: string | null, sigungu: string | null) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', margin: '0 0 20px',
      border: '0.5px solid var(--border)',
      background: 'var(--bg-surface, var(--bg-secondary))',
    }}>
      <div style={{
        padding: '11px 14px 10px', borderBottom: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 3, height: 15, borderRadius: 2, background: '#0F6E56' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>관련 아파트</span>
        {(sigungu || region) && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {sigungu || region}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>
          {apts.length}단지 발견
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {apts.map((a: any, idx: number) => {
          const isSeed = idx === 0;
          const href = a._source === 'complex'
            ? `/apt/complex/${encodeURIComponent(a.name)}`
            : `/apt/${a.slug || a.id}`;

          const imgs = Array.isArray(a.images) ? a.images : [];
          // 세션 140: og API fallback 보장 — FallbackThumb 대신 img 항상 렌더 (null placeholder 제거)
          const rawThumb = imgs.length > 0
            ? (typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.url || '')
            : '';
          const ogFallback = `/api/og?title=${encodeURIComponent(a.name || '')}&category=apt&design=2`;
          const thumbUrl = rawThumb || ogFallback;

          const price = a._source === 'complex'
            ? fmtComplexPrice(a.latest_sale_price)
            : fmtAptPriceRange(a.price_min, a.price_max);

          const locationLabel = a.sigungu || a.region || '';
          const yearLabel = a.built_year || (a.move_in_date ? String(a.move_in_date).slice(0, 4) : null);
          const subParts = [locationLabel, a.total_units ? `${Number(a.total_units).toLocaleString()}세대` : null, yearLabel].filter(Boolean);

          return (
            <Link
              key={`${a._source}-${a.id || idx}`}
              href={href}
              style={{
                flexShrink: 0, width: 152, borderRadius: 10, overflow: 'hidden',
                border: `0.5px solid ${isSeed ? '#5DCAA5' : 'var(--border)'}`,
                textDecoration: 'none', color: 'inherit',
                background: 'var(--bg-surface, var(--bg-secondary))',
                display: 'block',
              }}
            >
              {/* 썸네일 — 세션 140: img 항상 렌더, 외부 hotlink 차단 시 og fallback */}
              <div style={{ width: '100%', height: 88, position: 'relative' }}>
                <img
                  src={thumbUrl} alt={a.name || ''}
                  width={152} height={88}
                  style={{ width: '100%', height: 88, objectFit: 'cover', display: 'block' }}
                  loading="lazy" decoding="async" referrerPolicy="no-referrer"
                  onError={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.src.endsWith(ogFallback)) el.src = ogFallback; }}
                />
                {isSeed && (
                  <span style={{
                    position: 'absolute', top: 6, left: 6,
                    fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                  }}>
                    이 글의 단지
                  </span>
                )}
              </div>
              {/* 정보 */}
              <div style={{
                padding: '8px 10px 10px',
                background: isSeed ? 'rgba(225,245,238,0.5)' : 'transparent',
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: isSeed ? '#04342C' : 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {a.name}
                </div>
                <div style={{
                  fontSize: 10, color: isSeed ? '#0F6E56' : 'var(--text-tertiary)', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {subParts.join(' · ')}
                </div>
                {price && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: isSeed ? '#04342C' : 'var(--text-primary)', marginTop: 4, letterSpacing: '-0.3px' }}>
                    {price}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover, var(--bg-secondary))', color: 'var(--text-secondary)' }}>
                    {a._source === 'complex' ? '단지백과' : '현장 정보'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{
        padding: '8px 14px 10px', borderTop: '0.5px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Link href={sigungu ? `/apt?region=${encodeURIComponent(region || '')}&sigungu=${encodeURIComponent(sigungu)}` : region ? `/apt?region=${encodeURIComponent(region)}` : '/apt'} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          {sigungu ? `${sigungu} 전체` : region ? `${region} 전체` : '전체 현장 보기'} →
        </Link>
        <Link href="/apt/subscription" style={{
          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
          background: '#0F6E56', color: '#fff', textDecoration: 'none',
        }}>
          청약 일정 보기
        </Link>
      </div>
    </div>
  );
}

// ─── 부동산 하단 (기존 컴팩트) ───
function renderAptBottom(apts: any[], region: string | null, sigungu: string | null) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', margin: '16px 0',
      border: '0.5px solid var(--border)',
      background: 'var(--bg-surface, var(--bg-secondary))',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '9px 12px 8px', fontSize: 12, fontWeight: 600,
        color: 'var(--text-primary)',
        borderBottom: '0.5px solid var(--border)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', flexShrink: 0 }} />
        이 글과 관련된 아파트{sigungu ? ` · ${sigungu}` : region ? ` · ${region}` : ''}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {apts.map((a: any, idx: number) => {
          const href = a._source === 'complex'
            ? `/apt/complex/${encodeURIComponent(a.name)}`
            : `/apt/${a.slug || a.id}`;
          const imgs = Array.isArray(a.images) ? a.images : [];
          // 세션 140: og API fallback 보장 — img 항상 렌더
          const rawThumb = imgs.length > 0
            ? (typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.url || '')
            : '';
          const ogFallback = `/api/og?title=${encodeURIComponent(a.name || '')}&category=apt&design=2`;
          const thumbUrl = rawThumb || ogFallback;
          const price = a._source === 'complex'
            ? fmtComplexPrice(a.latest_sale_price)
            : fmtAptPriceRange(a.price_min, a.price_max);
          const locationLabel = [a.sigungu, a.dong].filter(Boolean).join(' ') || a.region || '';
          const yearLabel = a.built_year || (a.move_in_date ? String(a.move_in_date).slice(0, 4) : null);
          return (
            <Link
              key={`${a._source}-${a.id || idx}`}
              href={href}
              style={{
                flexShrink: 0, width: 136, borderRadius: 10, overflow: 'hidden',
                border: '0.5px solid var(--border)', textDecoration: 'none', color: 'inherit',
                background: 'var(--bg-surface, var(--bg-secondary))', display: 'block',
              }}
            >
              {/* 세션 140: img 항상 렌더 + og onError fallback */}
              <img
                src={thumbUrl} alt={a.name || ''}
                width={136} height={76}
                style={{ width: '100%', height: 76, objectFit: 'cover', display: 'block', background: 'var(--bg-hover)' }}
                loading="lazy" decoding="async" referrerPolicy="no-referrer"
                onError={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.src.endsWith(ogFallback)) el.src = ogFallback; }}
              />
              <div style={{ padding: '8px 8px 7px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {locationLabel}{a.total_units ? ` · ${Number(a.total_units).toLocaleString()}세대` : ''}{yearLabel ? ` · ${yearLabel}` : ''}
                </div>
                {price && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    {price}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover, var(--bg-secondary))', color: 'var(--text-secondary)' }}>
                    {a._source === 'complex' ? '단지백과' : '현장 정보'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div style={{
        padding: '7px 12px 8px', borderTop: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href={region ? `/apt?region=${encodeURIComponent(region)}` : '/apt'} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          {region ? `${region} 전체 현장` : '전체 현장 보기'} →
        </Link>
        <Link href="/apt/subscription" style={{
          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
          background: '#059669', color: '#fff', textDecoration: 'none',
        }}>
          청약 일정 보기
        </Link>
      </div>
    </div>
  );
}
