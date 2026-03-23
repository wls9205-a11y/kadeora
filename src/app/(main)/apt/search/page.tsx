import type { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { fmtAmount } from '@/lib/format';

export const metadata: Metadata = {
  title: '아파트 실거래가 검색 | 카더라',
  description: '전국 아파트 실거래가를 검색하세요. 단지명, 지역, 면적별 실거래 조회.',
  openGraph: {
    title: '아파트 실거래가 검색',
    description: '전국 아파트 실거래가 조회 — 단지명·지역·면적별 검색',
  },
  alternates: { canonical: 'https://kadeora.app/apt/search' },
};

export const revalidate = 300;

interface Props { searchParams: Promise<{ q?: string; region?: string; area?: string; page?: string }> }

export default async function AptSearchPage({ searchParams }: Props) {
  const { q = '', region = '', area = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, parseInt(page));
  const perPage = 30;

  const sb = await createSupabaseServer();

  let query = sb.from('apt_transactions')
    .select('id, apt_name, region_nm, sigungu, dong, deal_date, deal_amount, exclusive_area, floor, built_year, trade_type', { count: 'exact' })
    .order('deal_date', { ascending: false });

  if (q) query = query.or(`apt_name.ilike.%${q}%,dong.ilike.%${q}%,sigungu.ilike.%${q}%`);
  if (region) query = query.ilike('region_nm', `%${region}%`);
  if (area === 'small') query = query.lte('exclusive_area', 60);
  else if (area === 'mid') query = query.gt('exclusive_area', 60).lte('exclusive_area', 85);
  else if (area === 'large') query = query.gt('exclusive_area', 85);

  query = query.range((pageNum - 1) * perPage, pageNum * perPage - 1);
  const { data: trades, count } = await query;

  // 인기 지역
  let regionStats: any[] = [];
  try {
    const { data: rs } = await sb.rpc('get_trade_region_stats');
    regionStats = rs || [];
  } catch {}

  const totalCount = count || 0;
  const hasMore = (trades?.length || 0) === perPage;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 부동산</Link>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 4px' }}>🔍 실거래가 검색</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>전국 {totalCount.toLocaleString()}건의 실거래 데이터</p>

      {/* 검색 폼 */}
      <form method="GET" action="/apt/search" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input name="q" defaultValue={q} placeholder="단지명, 동 검색..." aria-label="실거래가 검색"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none' }} />
        <button type="submit" style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }}>검색</button>
      </form>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: '', label: '전체 면적' },
          { key: 'small', label: '소형 (~60㎡)' },
          { key: 'mid', label: '중형 (60~85㎡)' },
          { key: 'large', label: '대형 (85㎡~)' },
        ].map(f => (
          <Link key={f.key} href={`/apt/search?${q ? `q=${q}&` : ''}${region ? `region=${region}&` : ''}${f.key ? `area=${f.key}` : ''}`} style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600,
            background: area === f.key ? 'var(--brand)' : 'var(--bg-hover)',
            color: area === f.key ? '#fff' : 'var(--text-secondary)',
            textDecoration: 'none', border: 'none',
          }}>{f.label}</Link>
        ))}
      </div>

      {/* 인기 지역 (검색어 없을 때) */}
      {!q && regionStats && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>인기 지역</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(regionStats as any[])?.slice(0, 10).map((r: any) => (
              <Link key={r.region_nm} href={`/apt/search?region=${r.region_nm}`} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 500,
                background: region === r.region_nm ? 'var(--brand)' : 'var(--bg-surface)',
                color: region === r.region_nm ? '#fff' : 'var(--text-secondary)',
                textDecoration: 'none', border: '1px solid var(--border)',
              }}>{r.region_nm} ({r.cnt}건)</Link>
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
      {q && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>&quot;{q}&quot; 검색 결과 {totalCount.toLocaleString()}건</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(trades || []).map((t: any) => {
          const amt = t.deal_amount || 0;
          const color = amt >= 100000 ? 'var(--accent-red)' : amt >= 50000 ? 'var(--accent-orange)' : 'var(--accent-green)';
          return (
            <Link key={t.id} href={`/apt/complex/${encodeURIComponent(t.apt_name)}`} className="kd-card-hover" style={{ display: 'block', padding: '12px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{t.apt_name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {t.region_nm} {t.sigungu} {t.dong} · 전용 {t.exclusive_area}㎡ · {t.floor}층{t.built_year ? ` · ${t.built_year}년식` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color }}>{fmtAmount(amt)}</div>
                  {t.exclusive_area > 0 && amt > 0 && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평당 {fmtAmount(Math.round(amt / (t.exclusive_area / 3.3058)))}</div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                📅 {t.deal_date} · {t.trade_type || '매매'}
              </div>
            </Link>
          );
        })}
      </div>

      {(trades || []).length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{q ? '🔍' : '🏠'}</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {q ? `"${q}" 검색 결과가 없습니다` : '실거래가를 검색하세요'}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)' }}>
            {q ? '다른 단지명이나 동 이름으로 시도해보세요' : '단지명, 동 이름으로 검색하면 실거래 이력을 확인할 수 있어요'}
          </div>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalCount > perPage && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 40 }}>
          {pageNum > 1 && (
            <Link href={`/apt/search?${q ? `q=${q}&` : ''}${region ? `region=${region}&` : ''}${area ? `area=${area}&` : ''}page=${pageNum - 1}`}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-sm)' }}>← 이전</Link>
          )}
          <span style={{ padding: '8px 16px', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{pageNum} / {Math.ceil(totalCount / perPage)}</span>
          {hasMore && (
            <Link href={`/apt/search?${q ? `q=${q}&` : ''}${region ? `region=${region}&` : ''}${area ? `area=${area}&` : ''}page=${pageNum + 1}`}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-sm)' }}>다음 →</Link>
          )}
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '20px 0' }}>
        📊 국토교통부 실거래가 공개시스템 기준
      </p>

      {/* 지역별 부동산 내부 링크 (SEO) */}
      <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>🏙️ 지역별 부동산 정보</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'].map(r => (
            <Link key={r} href={`/apt/region/${encodeURIComponent(r)}`} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 500,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none',
              border: '1px solid var(--border)',
            }}>{r}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
