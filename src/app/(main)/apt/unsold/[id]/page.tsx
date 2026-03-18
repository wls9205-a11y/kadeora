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
  return { title: `${data.house_nm} 미분양 | 카더라`, description: `${data.region_nm} 미분양 현황` };
}

export default async function UnsoldDetailPage({ params }: Props) {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data: u } = await sb.from('unsold_apts').select('*').eq('id', Number(id)).single();
  if (!u) notFound();

  const rate = u.tot_supply_hshld_co ? Math.round((u.tot_unsold_hshld_co / u.tot_supply_hshld_co) * 100) : null;
  const pMin = u.sale_price_min ? Math.round(u.sale_price_min / 10000 * 10) / 10 : null;
  const pMax = u.sale_price_max ? Math.round(u.sale_price_max / 10000 * 10) / 10 : null;
  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <Link href="/apt" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>← 부동산</Link>

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>미분양</span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{u.house_nm || '미분양 단지'}</h1>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{u.region_nm}{u.sigungu_nm ? ` ${u.sigungu_nm}` : ''}{u.supply_addr ? ` · ${u.supply_addr}` : ''}</div>
      </div>

      {/* 미분양 현황 */}
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>미분양</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171' }}>{(u.tot_unsold_hshld_co || 0).toLocaleString()}<span style={{ fontSize: 12 }}>세대</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>총공급</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{u.tot_supply_hshld_co ? u.tot_supply_hshld_co.toLocaleString() : '-'}<span style={{ fontSize: 12 }}>세대</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>미분양률</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: rate && rate > 70 ? '#ef4444' : rate && rate > 40 ? '#f97316' : '#eab308' }}>{rate ?? '-'}%</div>
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
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📋 분양 정보</div>
        {[
          ['분양가', (pMin || pMax) ? `${pMin}억${pMax && pMax !== pMin ? `~${pMax}억` : ''} 원` : null],
          ['준공예정', u.completion_ym ? `${u.completion_ym.slice(0, 4)}년 ${parseInt(u.completion_ym.slice(4, 6))}월` : null],
          ['주소', u.supply_addr],
          ['문의', u.contact_tel],
        ].filter(r => r[1]).map(([label, value], i, arr) => (
          <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{label}</span>
            {label === '문의' ? <a href={`tel:${value}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>📞 {value}</a> : <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>}
          </div>
        ))}
      </div>

      {/* 위치 */}
      {(u.supply_addr || u.house_nm) && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🚇 위치</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>{u.supply_addr || u.house_nm}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`https://map.kakao.com/?q=${encodeURIComponent(u.supply_addr || u.house_nm)}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>카카오맵</a>
            <a href={`https://map.naver.com/search/${encodeURIComponent(u.supply_addr || u.house_nm)}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>네이버지도</a>
          </div>
        </div>
      )}

      {/* 한줄평 */}
      <div style={card}>
        <AptCommentInline houseKey={`unsold_${u.id}`} houseNm={u.house_nm || '미분양 단지'} houseType="unsold" />
      </div>

      {/* 외부 링크 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 0', borderRadius: 10, border: '1px solid var(--brand)', color: 'var(--brand)', textDecoration: 'none', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>분양 홈페이지 바로가기 →</a>}
        {u.contact_tel && <a href={`tel:${u.contact_tel}`} style={{ padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>📞 전화문의</a>}
      </div>
    </div>
  );
}
