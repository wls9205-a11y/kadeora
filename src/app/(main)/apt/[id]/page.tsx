import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import AptCommentInline from '@/components/AptCommentInline';

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const sb = await createSupabaseServer();
    const numId = Number(id);
    const { data: apt } = numId > 0 && !isNaN(numId)
      ? await sb.from('apt_subscriptions').select('house_nm, region_nm, tot_supply_hshld_co').eq('id', numId).single()
      : await sb.from('apt_subscriptions').select('house_nm, region_nm, tot_supply_hshld_co').eq('house_manage_no', id).single();
    if (!apt) return {};
    return { title: `${apt.house_nm} 청약 | 카더라`, description: `${apt.region_nm} · ${apt.tot_supply_hshld_co ?? '-'}세대` };
  } catch { return {}; }
}

function fmtYM(s: string | null) { if (!s) return null; return `${s.slice(0, 4)}년 ${parseInt(s.slice(4, 6))}월`; }

export default async function AptDetailPage({ params }: Props) {
  const { id } = await params;
  let apt: any = null;
  try {
    const sb = await createSupabaseServer();
    const numId = Number(id);
    const { data } = numId > 0 && !isNaN(numId)
      ? await sb.from('apt_subscriptions').select('*').eq('id', numId).single()
      : await sb.from('apt_subscriptions').select('*').eq('house_manage_no', id).single();
    apt = data;
  } catch {}
  if (!apt) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const status = !apt.rcept_bgnde ? 'upcoming' : today >= apt.rcept_bgnde && today <= apt.rcept_endde ? 'open' : today < apt.rcept_bgnde ? 'upcoming' : 'closed';
  const dday = apt.rcept_bgnde ? Math.ceil((new Date(apt.rcept_bgnde).getTime() - Date.now()) / 86400000) : null;
  const SB: Record<string, { label: string; bg: string; color: string; border: string }> = {
    open: { label: '접수중', bg: '#14532d', color: '#86efac', border: '#166534' },
    upcoming: { label: '접수예정', bg: '#1e3a5f', color: '#93c5fd', border: '#1e40af' },
    closed: { label: '마감', bg: 'transparent', color: 'var(--text-tertiary)', border: 'var(--border)' },
  };
  const badge = SB[status];
  const rows = [
    ['청약접수', apt.rcept_bgnde && apt.rcept_endde ? `${apt.rcept_bgnde} ~ ${apt.rcept_endde}` : null],
    ['특별공급', apt.spsply_rcept_bgnde ? `${apt.spsply_rcept_bgnde} ~ ${apt.spsply_rcept_endde}` : null],
    ['당첨자발표', apt.przwner_presnatn_de],
    ['계약', apt.cntrct_cncls_bgnde ? `${apt.cntrct_cncls_bgnde} ~ ${apt.cntrct_cncls_endde}` : null],
    ['입주예정', fmtYM(apt.mvn_prearnge_ym)],
    ['총공급', apt.tot_supply_hshld_co ? `${Number(apt.tot_supply_hshld_co).toLocaleString()}세대` : null],
  ].filter(r => r[1]);

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* 헤더 */}
      <Link href="/apt" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>← 부동산</Link>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{badge.label}</span>
          {status === 'upcoming' && dday !== null && dday >= 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>D-{dday}</span>}
          {apt.competition_rate_1st && Number(apt.competition_rate_1st) > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 10 }}>{Number(apt.competition_rate_1st).toFixed(1)}:1</span>
          )}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{apt.house_nm}</h1>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{apt.region_nm} · {apt.hssply_adres}{apt.tot_supply_hshld_co ? ` · ${Number(apt.tot_supply_hshld_co).toLocaleString()}세대` : ''}</div>
      </div>

      {/* 분양 일정 */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📅 분양 일정</div>
        {rows.map(([label, value], i) => (
          <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* 경쟁률 */}
      {apt.competition_rate_1st && Number(apt.competition_rate_1st) > 0 && (
        <div style={{ ...card, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🏆 청약 경쟁률</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#818cf8' }}>{Number(apt.competition_rate_1st).toFixed(1)} : 1 <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 400 }}>1순위 평균</span></div>
        </div>
      )}

      {/* 위치 */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🚇 위치 및 교통</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>{apt.hssply_adres}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`https://map.kakao.com/?q=${encodeURIComponent(apt.hssply_adres || apt.house_nm)}`} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>카카오맵</a>
          <a href={`https://map.naver.com/search/${encodeURIComponent(apt.hssply_adres || apt.house_nm)}`} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>네이버지도</a>
        </div>
      </div>

      {/* 한줄평 */}
      <div style={card}>
        <AptCommentInline houseKey={apt.house_manage_no || String(apt.id)} houseNm={apt.house_nm} houseType="sub" />
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
