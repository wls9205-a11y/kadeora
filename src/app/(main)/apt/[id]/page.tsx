import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: apt } = await supabase.from('apt_subscriptions').select('house_nm, region_nm, hssply_adres, rcept_bgnde, rcept_endde, tot_supply_hshld_co').eq('id', Number(id)).single();
  if (!apt) return { title: '카더라' };
  return {
    title: `${apt.house_nm} 청약 정보 | 카더라`,
    description: `${apt.house_nm} 청약 ${apt.rcept_bgnde}~${apt.rcept_endde}. ${apt.region_nm}. 공급 ${apt.tot_supply_hshld_co ?? '-'}세대.`,
    openGraph: { title: `${apt.house_nm} 청약`, description: `${apt.region_nm} · 공급 ${apt.tot_supply_hshld_co ?? '-'}세대`, images: [{ url: 'https://kadeora.app/og-image.svg', width: 1200, height: 628 }] },
  };
}

export default async function AptDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: apt } = await supabase.from('apt_subscriptions').select('*').eq('id', Number(id)).single();
  if (!apt) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const isActive = apt.rcept_bgnde && apt.rcept_endde && today >= apt.rcept_bgnde && today <= apt.rcept_endde;
  const isPast = apt.rcept_endde && today > apt.rcept_endde;
  const daysLeft = apt.rcept_bgnde ? Math.ceil((new Date(apt.rcept_bgnde).getTime() - Date.now()) / 86400000) : null;
  const badge = isActive ? { text: '📢 청약 진행 중', color: 'var(--success)' }
    : isPast ? { text: '✅ 청약 마감', color: 'var(--text-tertiary)' }
    : daysLeft !== null && daysLeft <= 7 ? { text: `⏰ D-${daysLeft} 청약 임박`, color: 'var(--brand)' }
    : { text: `📅 D-${daysLeft ?? '?'} 청약 예정`, color: 'var(--info)' };

  const mvnText = apt.mvn_prearnge_ym ? `${apt.mvn_prearnge_ym.slice(0,4)}년 ${apt.mvn_prearnge_ym.slice(4)}월` : '-';
  const infoItems = [
    { label: '📍 위치', value: apt.hssply_adres ?? '-' },
    { label: '🏠 공급세대', value: apt.tot_supply_hshld_co ? `${Number(apt.tot_supply_hshld_co).toLocaleString()}세대` : '-' },
    { label: '📅 청약 시작', value: apt.rcept_bgnde ?? '-' },
    { label: '📅 청약 마감', value: apt.rcept_endde ?? '-' },
    { label: '🏆 당첨자 발표', value: apt.przwner_presnatn_de ?? '-' },
    { label: '📝 계약', value: apt.cntrct_cncls_bgnde ? `${apt.cntrct_cncls_bgnde}~${apt.cntrct_cncls_endde}` : '-' },
    { label: '🔑 입주 예정', value: mvnText },
    { label: '🏗️ 지역', value: apt.region_nm ?? '-' },
  ];

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 100px' }}>
      <Link href="/apt" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: 20, display: 'inline-block' }}>← 청약 목록</Link>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: badge.color, background: 'var(--bg-hover)', padding: '4px 12px', borderRadius: 20 }}>{badge.text}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: 20 }}>{apt.region_nm}</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.3 }}>{apt.house_nm}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>📍 {apt.hssply_adres ?? '-'}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {infoItems.map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--info-bg)', border: '1px solid var(--info)', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        🏫 배정학교, 🚇 주변 교통 등은 <strong>청약홈 공고문</strong>이나 <strong>부동산 토론방</strong>에서 확인하세요.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <a href={apt.pblanc_url ?? 'https://www.applyhome.co.kr'} target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, textAlign: 'center', padding: 14, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          🏠 청약홈
        </a>
        <Link href="/discuss" style={{ flex: 1, textAlign: 'center', padding: 14, background: 'var(--brand)', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 700, color: 'var(--text-inverse)' }}>
          💬 토론방
        </Link>
      </div>
    </div>
  );
}
