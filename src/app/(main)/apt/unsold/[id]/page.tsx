import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import AptCommentInline from '@/components/AptCommentInline';

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data } = await sb.from('unsold_apts').select('house_nm, region_nm').eq('id', Number(id)).single();
  if (!data) return {};
  return { title: `${data.house_nm} 미분양`, description: `${data.region_nm} 미분양 현황` };
}

export default async function UnsoldDetailPage({ params }: Props) {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data: u } = await sb.from('unsold_apts').select('*').eq('id', Number(id)).single();
  if (!u) notFound();

  const rate = u.tot_supply_hshld_co ? Math.round((u.tot_unsold_hshld_co / u.tot_supply_hshld_co) * 100) : null;
  const pMin = u.sale_price_min ? Math.round(u.sale_price_min / 10000 * 10) / 10 : null;
  const pMax = u.sale_price_max ? Math.round(u.sale_price_max / 10000 * 10) / 10 : null;

  let relatedPosts: any[] = [];
  try {
    const searchTerm = (u.house_nm || '').slice(0, 4);
    if (searchTerm) {
      const { data: rp } = await sb.from('posts').select('id,title,created_at')
        .eq('is_deleted', false).ilike('title', `%${searchTerm}%`)
        .order('created_at', { ascending: false }).limit(3);
      relatedPosts = rp || [];
    }
  } catch { relatedPosts = []; }

  let nearbySubscriptions: any[] = [];
  try {
    if (u.region_nm) {
      const { data: ns } = await sb.from('apt_subscriptions').select('id,house_nm,region_nm,rcept_bgnde,rcept_endde')
        .eq('region_nm', u.region_nm)
        .order('created_at', { ascending: false }).limit(3);
      nearbySubscriptions = ns || [];
    }
  } catch { nearbySubscriptions = []; }

  // 미분양 추이 데이터
  let unsoldTrend: any[] = [];
  try {
    if (u.region_nm) {
      const { data: trend } = await sb.from('unsold_monthly_stats')
        .select('stat_month, total_unsold, after_completion')
        .eq('region', u.region_nm)
        .order('stat_month', { ascending: false })
        .limit(3);
      unsoldTrend = trend || [];
    }
  } catch {}

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>← 부동산</Link>

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>미분양</span>
        </div>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{u.house_nm || '미분양 단지'}</h1>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{u.region_nm}{u.sigungu_nm ? ` ${u.sigungu_nm}` : ''}{u.supply_addr ? ` · ${u.supply_addr}` : ''}</div>
      </div>

      {/* 현황 요약 */}
      <div style={{ ...card, borderLeft: `3px solid ${(u.tot_unsold_hshld_co || 0) >= 3000 ? '#EF4444' : (u.tot_unsold_hshld_co || 0) >= 1000 ? '#F59E0B' : '#10B981'}` }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📊 현황 요약</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>미분양 세대수</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{(u.tot_unsold_hshld_co || 0).toLocaleString()}세대</span>
          </div>
          {unsoldTrend.length >= 2 && (() => {
            const latest = unsoldTrend[0]?.total_unsold || 0;
            const prev = unsoldTrend[1]?.total_unsold || 0;
            const diff = latest - prev;
            const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : '0';
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>전월 대비</span>
                <span style={{ fontWeight: 700, color: diff > 0 ? '#EF4444' : diff < 0 ? '#10B981' : 'var(--text-tertiary)' }}>
                  {diff > 0 ? '+' : ''}{diff.toLocaleString()}세대 ({diff > 0 ? '↑' : diff < 0 ? '↓' : '-'}{pct}%)
                </span>
              </div>
            );
          })()}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>미분양률</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{rate !== null ? `${rate}%` : '정보 없음'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>위험도</span>
            <span style={{ fontWeight: 700 }}>
              {(u.tot_unsold_hshld_co || 0) >= 3000
                ? <span style={{ color: '#EF4444' }}>🔴 높음</span>
                : (u.tot_unsold_hshld_co || 0) >= 1000
                  ? <span style={{ color: '#F59E0B' }}>🟡 주의</span>
                  : <span style={{ color: '#10B981' }}>🟢 안전</span>
              }
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>총 공급</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.tot_supply_hshld_co ? `${u.tot_supply_hshld_co.toLocaleString()}세대` : '정보 없음'}</span>
          </div>
        </div>
      </div>

      {/* 미분양 현황 */}
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 3 }}>미분양</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: '#f87171' }}>{(u.tot_unsold_hshld_co || 0).toLocaleString()}<span style={{ fontSize: 'var(--fs-sm)' }}>세대</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 3 }}>총공급</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{u.tot_supply_hshld_co ? u.tot_supply_hshld_co.toLocaleString() : '-'}<span style={{ fontSize: 'var(--fs-sm)' }}>세대</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 3 }}>미분양률</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: rate && rate > 70 ? '#ef4444' : rate && rate > 40 ? '#f97316' : '#eab308' }}>{rate ?? '-'}%</div>
          </div>
        </div>
        {rate !== null && (
          <div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 3 }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? '#ef4444' : rate > 40 ? '#f97316' : '#eab308' }} />
          </div>
        )}
      </div>

      {/* 분양 정보 */}
      <div style={card}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📋 분양 정보</div>
        {[
          ['분양가', (pMin || pMax) ? `${pMin}억${pMax && pMax !== pMin ? `~${pMax}억` : ''} 원` : null],
          ['준공예정', u.completion_ym ? `${u.completion_ym.slice(0, 4)}년 ${parseInt(u.completion_ym.slice(4, 6))}월` : null],
          ['주소', u.supply_addr],
          ['문의', u.contact_tel],
        ].filter(r => r[1]).map(([label, value], i, arr) => (
          <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{label}</span>
            {label === '문의' ? <a href={`tel:${value}`} style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>📞 {value}</a> : <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>}
          </div>
        ))}
      </div>

      {/* 위치 */}
      {(u.supply_addr || u.house_nm) && (
        <div style={card}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🚇 위치</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 10 }}>{u.supply_addr || u.house_nm}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`https://map.kakao.com/?q=${encodeURIComponent(u.supply_addr || u.house_nm)}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>카카오맵</a>
            <a href={`https://map.naver.com/search/${encodeURIComponent(u.supply_addr || u.house_nm)}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>네이버지도</a>
          </div>
        </div>
      )}

      {/* 한줄평 */}
      <div style={card}>
        <AptCommentInline houseKey={`unsold_${u.id}`} houseNm={u.house_nm || '미분양 단지'} houseType="unsold" />
      </div>

      {/* 관련 게시글 */}
      {relatedPosts.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📋 관련 게시글</div>
          {relatedPosts.map((rp: any) => (
            <Link key={rp.id} href={`/feed/${rp.id}`} style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{rp.title}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{new Date(rp.created_at).toLocaleDateString('ko-KR')}</div>
            </Link>
          ))}
        </div>
      )}

      {/* 근처 청약 */}
      {nearbySubscriptions.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🏠 근처 청약</div>
          {nearbySubscriptions.map((ns: any) => (
            <Link key={ns.id} href={`/apt/${ns.id}`} style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{ns.house_nm}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{ns.region_nm}{ns.rcept_bgnde ? ` · ${ns.rcept_bgnde} ~ ${ns.rcept_endde}` : ''}</div>
            </Link>
          ))}
        </div>
      )}

      {/* 외부 링크 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 0', borderRadius: 10, border: '1px solid var(--brand)', color: 'var(--brand)', textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, textAlign: 'center' }}>분양 홈페이지 바로가기 →</a>}
        {u.contact_tel && <a href={`tel:${u.contact_tel}`} style={{ padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: 600, textAlign: 'center' }}>📞 전화문의</a>}
      </div>
    </div>
  );
}
