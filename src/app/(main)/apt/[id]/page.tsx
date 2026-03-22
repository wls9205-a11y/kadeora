import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import AptCommentInline from '@/components/AptCommentInline';
import ShareButtons from '@/components/ShareButtons';
import AptBookmarkButton from '@/components/AptBookmarkButton';

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const sb = await createSupabaseServer();
    const isHouseManageNo = /^\d{7,}$/.test(id) && id.length >= 7;
    const numId = Number(id);
    const { data: apt } = isHouseManageNo
      ? await sb.from('apt_subscriptions').select('house_nm, region_nm, tot_supply_hshld_co').eq('house_manage_no', id).single()
      : (numId > 0 && !isNaN(numId))
        ? await sb.from('apt_subscriptions').select('house_nm, region_nm, tot_supply_hshld_co').eq('id', numId).single()
        : await sb.from('apt_subscriptions').select('house_nm, region_nm, tot_supply_hshld_co').eq('house_manage_no', id).single();
    if (!apt) return {};
    return {
      title: `${apt.house_nm} 청약`,
      description: `${apt.region_nm} · ${apt.tot_supply_hshld_co ?? '-'}세대`,
      alternates: {
        canonical: `https://kadeora.app/apt/${id}`,
      },
    };
  } catch { return {}; }
}

function fmtYM(s: string | null) { if (!s) return null; return `${s.slice(0, 4)}년 ${parseInt(s.slice(4, 6))}월`; }

export default async function AptDetailPage({ params }: Props) {
  const { id } = await params;
  let apt: any = null;
  try {
    const sb = await createSupabaseServer();
    const isHouseManageNo = /^\d{7,}$/.test(id) && id.length >= 7;
    const numId = Number(id);
    const { data } = isHouseManageNo
      ? await sb.from('apt_subscriptions').select('*').eq('house_manage_no', id).single()
      : (numId > 0 && !isNaN(numId))
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
    ['분양유형', apt.mdatrgbn_nm || null],
    ['청약접수', apt.rcept_bgnde && apt.rcept_endde ? `${apt.rcept_bgnde} ~ ${apt.rcept_endde}` : null],
    ['특별공급', apt.spsply_rcept_bgnde ? `${apt.spsply_rcept_bgnde} ~ ${apt.spsply_rcept_endde}` : null],
    ['당첨자발표', apt.przwner_presnatn_de],
    ['계약', apt.cntrct_cncls_bgnde ? `${apt.cntrct_cncls_bgnde} ~ ${apt.cntrct_cncls_endde}` : null],
    ['입주예정', fmtYM(apt.mvn_prearnge_ym)],
    ['총공급', apt.tot_supply_hshld_co ? `${Number(apt.tot_supply_hshld_co).toLocaleString()}세대` : null],
    ['특별공급', apt.special_supply_total ? `${Number(apt.special_supply_total).toLocaleString()}세대` : null],
    ['일반공급', apt.general_supply_total ? `${Number(apt.general_supply_total).toLocaleString()}세대` : null],
  ].filter(r => r[1]);

  const { data: { user: aptUser } } = await createSupabaseServer().then(s => s.auth.getUser());

  let relatedPosts: any[] = [];
  try {
    const sbRel = await createSupabaseServer();
    const { data: rp } = await sbRel.from('posts').select('id,title,created_at')
      .eq('is_deleted', false).ilike('title', `%${apt.house_nm.slice(0,4)}%`)
      .order('created_at', { ascending: false }).limit(3);
    relatedPosts = rp || [];
  } catch { relatedPosts = []; }

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* 헤더 */}
      <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>← 부동산</Link>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{badge.label}</span>
          {status === 'upcoming' && dday !== null && dday >= 0 && <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--brand)' }}>D-{dday}</span>}
          {apt.competition_rate_1st && Number(apt.competition_rate_1st) > 0 && (
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 10 }}>{Number(apt.competition_rate_1st).toFixed(1)}:1</span>
          )}
        </div>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{apt.house_nm}</h1>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{apt.region_nm} · {apt.hssply_adres}{apt.tot_supply_hshld_co ? ` · ${Number(apt.tot_supply_hshld_co).toLocaleString()}세대` : ''}</div>
      </div>

      {/* 공유 + 청약홈 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <ShareButtons title={`${apt.house_nm} 청약`} postId={id} />
        <a href={apt.pblanc_url || 'https://www.applyhome.co.kr'} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 'var(--fs-sm)', fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(59,130,246,0.2)' }}>
          🏠 청약홈
        </a>
        <AptBookmarkButton aptId={apt.id} isLoggedIn={!!aptUser} />
      </div>

      {/* 분양 일정 */}
      <div style={card}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📅 분양 일정</div>
        {rows.map(([label, value], i) => (
          <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{label}</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* 경쟁률 */}
      {apt.competition_rate_1st && Number(apt.competition_rate_1st) > 0 && (
        <div style={{ ...card, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🏆 청약 경쟁률</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: '#818cf8', marginBottom: 12 }}>{Number(apt.competition_rate_1st).toFixed(1)} : 1 <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 400 }}>1순위 평균</span></div>
          {apt.total_apply_count && apt.supply_count && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>
              총 지원 {Number(apt.total_apply_count).toLocaleString()}명 / 공급 {Number(apt.supply_count).toLocaleString()}세대
            </div>
          )}
          {/* 평형별 경쟁률 */}
          {apt.house_type_info && Array.isArray(apt.house_type_info) && apt.house_type_info.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>평형별 경쟁률</div>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)' }}>평형</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>공급</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>지원</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>경쟁률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(apt.house_type_info as any[]).map((t: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.type || t.area || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{(t.supply || 0).toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{(t.apply || 0).toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: (t.rate || 0) >= 10 ? '#ef4444' : (t.rate || 0) >= 5 ? '#f97316' : '#818cf8' }}>
                          {t.rate ? `${t.rate}:1` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 위치 */}
      <div style={card}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🚇 위치 및 교통</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 10 }}>{apt.hssply_adres}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`https://map.kakao.com/?q=${encodeURIComponent(apt.hssply_adres || apt.house_nm)}`} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>카카오맵</a>
          <a href={`https://map.naver.com/search/${encodeURIComponent(apt.hssply_adres || apt.house_nm)}`} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>네이버지도</a>
        </div>
      </div>

      {/* 한줄평 */}
      <div style={card}>
        <AptCommentInline houseKey={apt.house_manage_no || String(apt.id)} houseNm={apt.house_nm} houseType="sub" />
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

      <div style={{ height: 24 }} />
    </div>
  );
}
