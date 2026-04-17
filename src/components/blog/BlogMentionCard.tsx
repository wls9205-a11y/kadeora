import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

/**
 * BlogMentionCard — 블로그 글 내 언급된 종목/단지를 감지하여
 * 해당 하위 페이지로 유도하는 컴팩트 가로스크롤 카드.
 *
 * v2 (세션 114):
 * - apt_sites: 존재하지 않는 컬럼(households, avg_price) 제거 → total_units, price_min/max 사용
 * - apt_sites 라우팅: /apt/[slug] 로 수정 (기존 /apt/${id}는 slug 조회 실패)
 * - apt_complex_profiles: name → apt_name (컬럼명 오타 수정)
 * - 지역 필터: 블로그 tags/title에서 시·도 추출 → apt_sites.region 으로 1차 필터
 * - 주식 섹터 폴백: 매칭 <2 이면 같은 섹터·시장 인기 종목으로 채움 (최대 6개)
 * - 매칭 <2 이면 카드 숨김 (1개짜리 빈 카드 방지)
 * - try/catch로 조용한 실패 방지 + 에러 로깅
 */

interface Props {
  tags: string[];
  category: string;
  sourceRef?: string | null;
  title?: string;
}

// ─── 한국 시도 목록 (지역 컨텍스트 추출용) ───
const SIDO_LIST = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

// 시군구 종결 패턴 (~시, ~군, ~구)
const SIGUNGU_RE = /^.{1,5}(시|군|구)$/;

// 블로그 태그/제목에서 시도 추출
function extractRegion(tags: string[], title: string = ''): string | null {
  const haystack = [title, ...(tags || [])].join(' ');
  for (const sido of SIDO_LIST) {
    if (haystack.includes(sido)) return sido;
  }
  return null;
}

// 블로그 태그/제목에서 시군구 추출 (더 정밀한 지역 필터)
function extractSigungu(tags: string[], title: string = ''): string | null {
  // 태그 우선
  for (const t of tags || []) {
    if (t && SIGUNGU_RE.test(t)) return t;
  }
  // 제목에서도 시도
  const words = (title || '').split(/[\s—·|(),]/);
  for (const w of words) {
    if (w && SIGUNGU_RE.test(w)) return w;
  }
  return null;
}

// 제목에서 단지명 추출 (첫 공백/대시 전)
// "청운 시세 현황" → "청운"
// "주공2 실거래가 분석 — 대전 대덕구..." → "주공2"
// "완도미림주상복합아파트 실거래가..." → "완도미림주상복합아파트"
function extractComplexName(title: string): string | null {
  if (!title) return null;
  const first = title.trim().split(/[\s—·|(),]/)[0];
  if (!first || first.length < 2) return null;
  // 숫자/괄호만 제외
  if (/^\d+$/.test(first) || /^\(/.test(first)) return null;
  // 지역명 제외 (구형 블로그: 첫 단어가 지역)
  if (SIDO_LIST.includes(first)) return null;
  // 시/군/구 단독 패턴 제외
  if (SIGUNGU_RE.test(first)) return null;
  // 흔한 일반 단어 제외
  if (['중국', '미국', '일본', '글로벌', '부동산', '주식', '아파트', '분양'].includes(first)) return null;
  return first;
}

// 매우 짧거나 흔한 단어 필터 (ilike 노이즈 차단)
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
  // 지역명 제외 (region/sigungu 필터로만 사용)
  if (SIDO_LIST.includes(t)) return false;
  if (SIGUNGU_RE.test(t)) return false;
  return true;
}

// ─── 주식 매칭 ───
async function fetchStockMentions(tags: string[], sourceRef?: string | null) {
  try {
    const sb = await createSupabaseServer();
    const allTags = [...(tags || [])].filter(Boolean);

    // sourceRef가 종목 심볼이면 태그에 추가
    if (sourceRef && /^[A-Z0-9]{2,10}$/.test(sourceRef)) {
      allTags.unshift(sourceRef);
    }

    if (!allTags.length) return [];

    // 태그에서 종목명/심볼 매칭 시도 (eq 전용 — ilike는 오매칭 위험)
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

    // 중복 제거 + 합치기
    const map = new Map<string, any>();
    for (const s of [...(bySymbolRes.data || []), ...(byNameRes.data || [])] as any[]) {
      if (!map.has(s.symbol)) map.set(s.symbol, s);
    }
    const matched = [...map.values()];

    // 섹터 폴백: 매칭 <2 이면 같은 섹터·시장 인기 종목으로 채움
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

// ─── 부동산 매칭 ───
// 전략:
// 1. 제목 단지명 + 시군구(가장 정밀) — 가장 신뢰도 높음
// 2. 제목 단지명 + 시도 (시군구 없으면)
// 3. 제목 단지명 만 (지역 없으면)
// 4. 유용한 태그들 + 지역 필터 (위에서 못 찾으면)
// 5. 유용한 태그들만 (최종 폴백)
// 6. apt_complex_profiles 단지백과 폴백
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

    // helper: 결과에 추가
    const addResults = (data: any[] | null) => {
      if (!data) return;
      for (const d of data) {
        const key = `site-${d.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        results.push({ ...d, _source: 'site' });
      }
    };

    // 1차: 제목 단지명 + 시군구 (가장 정밀)
    if (complexName && sigungu) {
      const { data, error } = await (sb as any)
        .from('apt_sites')
        .select(SELECT_COLS)
        .ilike('name', `%${complexName}%`)
        .eq('sigungu', sigungu)
        .limit(6);
      if (error) console.error('[BlogMentionCard] apt stage1 error:', error.message);
      addResults(data);
    }

    // 2차: 제목 단지명 + 시도
    if (results.length < 2 && complexName && region) {
      const { data } = await (sb as any)
        .from('apt_sites')
        .select(SELECT_COLS)
        .ilike('name', `%${complexName}%`)
        .eq('region', region)
        .limit(6);
      addResults(data);
    }

    // 3차: 제목 단지명만
    if (results.length < 2 && complexName) {
      const { data } = await (sb as any)
        .from('apt_sites')
        .select(SELECT_COLS)
        .ilike('name', `%${complexName}%`)
        .limit(6);
      addResults(data);
    }

    // 4차: 유용한 태그들 + 시군구/시도 필터
    if (results.length < 2 && usefulTags.length) {
      for (const tag of usefulTags) {
        let q = (sb as any)
          .from('apt_sites')
          .select(SELECT_COLS)
          .ilike('name', `%${tag}%`)
          .limit(4);
        if (sigungu) q = q.eq('sigungu', sigungu);
        else if (region) q = q.eq('region', region);
        const { data, error } = await q;
        if (error) {
          console.error('[BlogMentionCard] apt stage4 error:', error.message);
          continue;
        }
        addResults(data);
        if (results.length >= 6) break;
      }
    }

    // 5차: 태그 매칭 (지역 필터 없이 — 마지막 수단)
    if (results.length === 0 && usefulTags.length) {
      for (const tag of usefulTags) {
        const { data } = await (sb as any)
          .from('apt_sites')
          .select(SELECT_COLS)
          .ilike('name', `%${tag}%`)
          .limit(3);
        addResults(data);
        if (results.length >= 6) break;
      }
    }

    // 6차: apt_complex_profiles 단지백과 폴백 (< 3건일 때만)
    if (results.length < 3) {
      const complexTerms = [complexName, ...usefulTags].filter(Boolean).slice(0, 4);
      for (const tag of complexTerms) {
        let q = (sb as any)
          .from('apt_complex_profiles')
          .select('id, apt_name, region_nm, sigungu, dong, total_households, built_year, images, latest_sale_price, sale_count_1y')
          .ilike('apt_name', `%${tag}%`)
          .limit(3);
        if (sigungu) q = q.eq('sigungu', sigungu);
        else if (region) q = q.ilike('region_nm', `%${region}%`);
        const { data, error } = await q;
        if (error) {
          console.error('[BlogMentionCard] apt_complex_profiles error:', error.message);
          continue;
        }
        for (const d of (data || []) as any[]) {
          const key = `complex-${d.apt_name}-${d.sigungu || ''}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          results.push({
            id: d.id,
            slug: null,
            name: d.apt_name,
            region: d.region_nm,
            sigungu: d.sigungu,
            address: d.dong,
            total_units: d.total_households,
            move_in_date: d.built_year ? `${d.built_year}` : null,
            built_year: d.built_year,
            images: d.images,
            price_min: null,
            price_max: null,
            latest_sale_price: d.latest_sale_price,
            _source: 'complex',
          });
        }
        if (results.length >= 6) break;
      }
    }

    // 7차: 같은 시군구 인기 단지 폴백 (결과가 < 3건이면 거래 활발 단지로 채움)
    if (results.length >= 1 && results.length < 3 && sigungu) {
      const { data } = await (sb as any)
        .from('apt_complex_profiles')
        .select('id, apt_name, region_nm, sigungu, dong, total_households, built_year, images, latest_sale_price, sale_count_1y')
        .eq('sigungu', sigungu)
        .not('sale_count_1y', 'is', null)
        .order('sale_count_1y', { ascending: false })
        .limit(8);
      for (const d of (data || []) as any[]) {
        const key = `complex-${d.apt_name}-${d.sigungu || ''}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        results.push({
          id: d.id,
          slug: null,
          name: d.apt_name,
          region: d.region_nm,
          sigungu: d.sigungu,
          address: d.dong,
          total_units: d.total_households,
          move_in_date: d.built_year ? `${d.built_year}` : null,
          built_year: d.built_year,
          images: d.images,
          price_min: null,
          price_max: null,
          latest_sale_price: d.latest_sale_price,
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

// ─── 가격 포맷 ───
// price_min/max 단위: 만원
function fmtAptPriceRange(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const v = max || min || 0;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}억~`;
  if (v > 0) return `${v.toLocaleString()}만~`;
  return null;
}

// latest_sale_price 단위: 만원 (apt_complex_profiles)
function fmtComplexPrice(v: number | null): string | null {
  if (!v) return null;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${v.toLocaleString()}만`;
}

function fmtStockPrice(v: number, market: string): string {
  if (['NYSE', 'NASDAQ'].includes(market)) return `$${v.toLocaleString('en', { maximumFractionDigits: 2 })}`;
  return v.toLocaleString() + '원';
}

export default async function BlogMentionCard({ tags, category, sourceRef, title }: Props) {
  const isStock = category === 'stock';
  const isApt = ['apt', 'unsold', 'redev', 'subscription'].includes(category);

  if (!isStock && !isApt) return null;
  if (!tags?.length) return null;

  // ─────── 주식 카드 ───────
  if (isStock) {
    const stocks = await fetchStockMentions(tags, sourceRef);

    // 2개 미만이면 카드 숨김 (1개짜리 카드 UX 방지)
    if (stocks.length < 2) return null;

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
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#3B82F6',
            display: 'inline-block', flexShrink: 0,
          }} />
          이 글과 관련된 종목
        </div>

        <div style={{
          display: 'flex', gap: 8, padding: '10px 12px',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
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
                  position: 'relative', transition: 'transform 0.15s',
                }}
              >
                <div style={{
                  width: '100%', height: 48,
                  background: isUp
                    ? 'linear-gradient(180deg, rgba(5,150,105,0.08) 0%, transparent 100%)'
                    : 'linear-gradient(180deg, rgba(220,38,38,0.08) 0%, transparent 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 700, color: isUp ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)',
                  letterSpacing: -1,
                }}>
                  {isUp ? '↗' : '↘'}
                </div>
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                  color: '#fff',
                  background: isUp ? 'rgba(5,150,105,0.85)' : 'rgba(220,38,38,0.85)',
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
          padding: '7px 12px 8px',
          borderTop: '0.5px solid var(--border)',
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

  // ─────── 부동산 카드 ───────
  const region = extractRegion(tags, title);
  const sigungu = extractSigungu(tags, title);
  const complexName = extractComplexName(title || '');
  const apts = await fetchAptMentions(tags, region, sigungu, complexName);

  // 2개 미만이면 카드 숨김
  if (apts.length < 2) return null;

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
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#10B981',
          display: 'inline-block', flexShrink: 0,
        }} />
        이 글과 관련된 아파트{sigungu ? ` · ${sigungu}` : region ? ` · ${region}` : ''}
      </div>

      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {apts.map((a: any, idx: number) => {
          // /apt/[slug] 라우팅: apt_sites는 slug, apt_complex_profiles는 name을 URL-encode
          const href = a._source === 'complex'
            ? `/apt/complex/${encodeURIComponent(a.name)}`
            : `/apt/${a.slug || a.id}`;

          const imgs = Array.isArray(a.images) ? a.images : [];
          const thumbUrl = imgs.length > 0
            ? (typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.url || '')
            : '';

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
                transition: 'transform 0.15s',
              }}
            >
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={a.name || ''}
                  width={136}
                  height={76}
                  style={{ width: '100%', height: 76, objectFit: 'cover', display: 'block', background: 'var(--bg-hover)' }}
                  loading="lazy"
                />
              ) : (
                <div style={{
                  width: '100%', height: 76,
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  🏢
                </div>
              )}
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
        padding: '7px 12px 8px',
        borderTop: '0.5px solid var(--border)',
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
