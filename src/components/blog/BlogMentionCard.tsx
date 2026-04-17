import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

/**
 * BlogMentionCard — 블로그 글 내 언급된 종목/단지를 감지하여
 * 해당 하위 페이지로 유도하는 컴팩트 가로스크롤 카드.
 *
 * 블로그 글의 tags + category 기반으로 자동 매칭:
 * - category='stock' → stock_quotes에서 태그 매칭 → /stock/[symbol]
 * - category='apt'|'unsold'|'redev' → apt_sites에서 태그 매칭 → /apt/[id]
 *
 * 삽입 위치: blog/[slug]/page.tsx 본문 하단, RelatedContentCard 위
 */

interface Props {
  tags: string[];
  category: string;
  sourceRef?: string | null;
}

// ─── 주식 매칭 ───
async function fetchStockMentions(tags: string[], sourceRef?: string | null) {
  const sb = await createSupabaseServer();
  const allTags = [...tags];

  // sourceRef가 종목 심볼이면 태그에 추가
  if (sourceRef && /^[A-Z0-9]{2,10}$/.test(sourceRef)) {
    allTags.unshift(sourceRef);
  }

  if (!allTags.length) return [];

  // 태그에서 종목명/심볼 매칭 시도
  const { data: bySymbol } = await sb
    .from('stock_quotes')
    .select('symbol, name, price, change_pct, change_amt, market, sector, per, dividend_yield')
    .in('symbol', allTags)
    .eq('is_active', true)
    .gt('price', 0)
    .limit(8);

  const { data: byName } = await sb
    .from('stock_quotes')
    .select('symbol, name, price, change_pct, change_amt, market, sector, per, dividend_yield')
    .in('name', allTags)
    .eq('is_active', true)
    .gt('price', 0)
    .limit(8);

  // 중복 제거 + 합치기
  const map = new Map<string, any>();
  for (const s of [...(bySymbol || []), ...(byName || [])] as any[]) {
    if (!map.has(s.symbol)) map.set(s.symbol, s);
  }
  return [...map.values()].slice(0, 6);
}

// ─── 부동산 매칭 ───
async function fetchAptMentions(tags: string[]) {
  if (!tags.length) return [];
  const sb = await createSupabaseServer();

  // 태그에서 아파트명 매칭
  const results: any[] = [];

  for (const tag of tags.slice(0, 10)) {
    if (tag.length < 2) continue;

    const { data } = await (sb as any)
      .from('apt_sites')
      .select('id, name, address, sigungu, households, move_in_date, images, avg_price')
      .ilike('name', `%${tag}%`)
      .limit(2);

    if (data?.length) {
      for (const d of data) {
        if (!results.find(r => r.id === d.id)) results.push(d);
      }
    }
    if (results.length >= 6) break;
  }

  // 태그 매칭 부족 시 → 단지백과에서도 검색
  if (results.length < 3) {
    for (const tag of tags.slice(0, 5)) {
      if (tag.length < 2) continue;
      const { data } = await (sb as any)
        .from('apt_complex_profiles')
        .select('id, name, address, sigungu, total_units, built_year, images')
        .ilike('name', `%${tag}%`)
        .limit(2);

      if (data?.length) {
        for (const d of data) {
          if (!results.find(r => r.name === d.name)) {
            results.push({
              id: `complex-${d.id}`,
              name: d.name,
              address: d.address,
              sigungu: d.sigungu,
              households: d.total_units,
              move_in_date: d.built_year ? `${d.built_year}년` : null,
              images: d.images,
              avg_price: null,
              isComplex: true,
            });
          }
        }
      }
      if (results.length >= 6) break;
    }
  }

  return results.slice(0, 6);
}

// ─── 가격 포맷 ───
function fmtAptPrice(v: number | null) {
  if (!v) return null;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}억`;
  return `${Math.round(v).toLocaleString()}만`;
}

function fmtStockPrice(v: number, market: string) {
  if (['NYSE', 'NASDAQ'].includes(market)) return `$${v.toLocaleString('en', { maximumFractionDigits: 2 })}`;
  return v.toLocaleString() + '원';
}

export default async function BlogMentionCard({ tags, category, sourceRef }: Props) {
  const isStock = category === 'stock';
  const isApt = ['apt', 'unsold', 'redev', 'subscription'].includes(category);

  if (!isStock && !isApt) return null;
  if (!tags?.length) return null;

  if (isStock) {
    const stocks = await fetchStockMentions(tags, sourceRef);
    if (!stocks.length) return null;

    return (
      <div style={{
        borderRadius: 14, overflow: 'hidden', margin: '16px 0',
        border: '0.5px solid var(--border)',
        background: 'var(--bg-surface, var(--bg-secondary))',
      }}>
        {/* 헤더 */}
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
          이 글에서 언급된 종목
        </div>

        {/* 가로 스크롤 */}
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
                {/* 미니 차트 영역 (배경색으로 대체) */}
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
                {/* 등락 배지 */}
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
                      {fmtStockPrice(s.price, s.market)}
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

        {/* 풋터 */}
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

  // ─── 부동산 카드 ───
  const apts = await fetchAptMentions(tags);
  if (!apts.length) return null;

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', margin: '16px 0',
      border: '0.5px solid var(--border)',
      background: 'var(--bg-surface, var(--bg-secondary))',
    }}>
      {/* 헤더 */}
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
        이 글에 나온 아파트
      </div>

      {/* 가로 스크롤 */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {apts.map((a: any, idx: number) => {
          const href = a.isComplex
            ? `/apt/complex/${encodeURIComponent(a.name)}`
            : `/apt/${a.id}`;
          const imgs = Array.isArray(a.images) ? a.images : [];
          const thumbUrl = imgs.length > 0
            ? (typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.url || '')
            : '';
          const price = fmtAptPrice(a.avg_price);

          return (
            <Link
              key={`${a.id || idx}`}
              href={href}
              style={{
                flexShrink: 0, width: 136, borderRadius: 10, overflow: 'hidden',
                border: '0.5px solid var(--border)', textDecoration: 'none', color: 'inherit',
                background: 'var(--bg-surface, var(--bg-secondary))', display: 'block',
                transition: 'transform 0.15s',
              }}
            >
              {/* 썸네일 */}
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
                  {a.sigungu || ''}{a.households ? ` · ${a.households.toLocaleString()}세대` : ''}{a.move_in_date ? ` · ${String(a.move_in_date).slice(0, 4)}` : ''}
                </div>
                {price && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    {price}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-hover, var(--bg-secondary))', color: 'var(--text-secondary)' }}>
                    {a.isComplex ? '단지백과' : '현장 정보'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 풋터 */}
      <div style={{
        padding: '7px 12px 8px',
        borderTop: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/apt" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          전체 현장 보기 →
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
