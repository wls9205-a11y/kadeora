'use client';
import { useState } from 'react';

interface Apt {
  id: number;
  house_manage_no: string;
  house_nm: string;
  region_cd: string;
  region_nm: string;
  supply_addr: string;
  tot_supply_hshld_co: number;
  rcept_bgnde: string;
  rcept_endde: string;
  spsply_rcept_bgnde: string;
  spsply_rcept_endde: string;
  przwner_presnatn_de: string;
  cntrct_cncls_bgnde: string;
  cntrct_cncls_endde: string;
  mdatrgbn_nm: string;
  hssply_adres: string;
  mvn_prearnge_ym: string;
  pblanc_url: string;
  fetched_at: string;
}

interface Props {
  apts: Apt[];
  isDemo: boolean;
}

const REGIONS = ['전체','서울','경기','인천','부산','대구','광주','대전','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];

function fmtDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

function statusBadge(apt: Apt) {
  const today = new Date();
  const start = new Date(apt.rcept_bgnde);
  const end = new Date(apt.rcept_endde);
  if (today < start) {
    const days = Math.ceil((start.getTime() - today.getTime()) / 86400000);
    return { label: `D-${days}`, color: '#FF4500', bg: 'rgba(255,69,0,0.12)' };
  }
  if (today <= end) return { label: '접수중', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
  return { label: '마감', color: '#818384', bg: 'rgba(129,131,132,0.12)' };
}

export default function AptClient({ apts, isDemo }: Props) {
  const [region, setRegion] = useState('전체');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'open' | 'closed'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const today = new Date();

  const filtered = apts
    .filter(a => region === '전체' || a.region_nm === region)
    .filter(a => {
      if (filter === 'upcoming') return new Date(a.rcept_bgnde) > today;
      if (filter === 'open') return new Date(a.rcept_bgnde) <= today && new Date(a.rcept_endde) >= today;
      if (filter === 'closed') return new Date(a.rcept_endde) < today;
      return true;
    })
    .filter(a => !search || a.house_nm.includes(search) || a.supply_addr?.includes(search))
    .sort((a, b) => new Date(a.rcept_bgnde).getTime() - new Date(b.rcept_bgnde).getTime());

  const openCount = apts.filter(a => new Date(a.rcept_bgnde) <= today && new Date(a.rcept_endde) >= today).length;
  const upcomingCount = apts.filter(a => new Date(a.rcept_bgnde) > today).length;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--kd-text)' }}>🏠 아파트 청약 정보</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--kd-text-dim)' }}>
          실시간 청약 일정 · 전국 {apts.length}건
          <span style={{ marginLeft: 12, color: '#10B981', fontWeight: 700 }}>● 접수중 {openCount}건</span>
          <span style={{ marginLeft: 8, color: '#FF4500', fontWeight: 700 }}>◆ 예정 {upcomingCount}건</span>
        </p>
      </div>

      {isDemo && (
        <div style={{
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 4, padding: '10px 14px', marginBottom: 12,
          fontSize: 13, color: 'var(--kd-primary)',
        }}>
          ℹ 데모 데이터를 표시 중입니다. 실제 데이터는 공공데이터 API에서 자동으로 갱신됩니다.
        </div>
      )}

      {/* 필터 */}
      <div style={{
        background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
        borderRadius: 4, padding: '10px 12px', marginBottom: 10,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* 지역 필터 */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {REGIONS.map(r => (
            <button key={r} onClick={() => setRegion(r)} style={{
              padding: '5px 10px', borderRadius: 2, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: region === r ? '#FF4500' : 'transparent',
              color: region === r ? '#fff' : 'var(--kd-text-dim)',
            }}>{r}</button>
          ))}
        </div>
        {/* 상태 + 검색 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {([['all','전체'],['upcoming','예정'],['open','접수중'],['closed','마감']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '6px 12px', borderRadius: 2, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: filter === k ? 'var(--kd-border)' : 'transparent',
              color: filter === k ? 'var(--kd-text)' : 'var(--kd-text-dim)',
            }}>{l}</button>
          ))}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="단지명 · 주소 검색"
            style={{
              marginLeft: 'auto', padding: '6px 12px', fontSize: 13,
              background: 'var(--kd-surface-2, var(--kd-border))',
              border: '1px solid var(--kd-border)', borderRadius: 4,
              color: 'var(--kd-text)', width: 200,
            }}
          />
        </div>
      </div>

      {/* 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(apt => {
          const badge = statusBadge(apt);
          const isOpen = expanded === apt.id;
          return (
            <div key={apt.id} style={{
              background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
              borderRadius: 4, overflow: 'hidden',
            }}>
              {/* 요약 행 */}
              <div
                onClick={() => setExpanded(isOpen ? null : apt.id)}
                style={{
                  padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--kd-border)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* 지역 배지 */}
                <div style={{
                  flexShrink: 0, width: 44, height: 44, borderRadius: 4,
                  background: '#FF4500', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{apt.region_nm}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--kd-text)' }}>{apt.house_nm}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 2,
                      background: badge.bg, color: badge.color,
                    }}>{badge.label}</span>
                    {apt.mdatrgbn_nm && (
                      <span style={{
                        fontSize: 11, padding: '2px 6px', borderRadius: 2,
                        background: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontWeight: 600,
                      }}>{apt.mdatrgbn_nm}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--kd-text-dim)', marginBottom: 6 }}>
                    {apt.supply_addr || apt.hssply_adres}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--kd-text-dim)', flexWrap: 'wrap' }}>
                    <span>🏘 총 <strong style={{ color: 'var(--kd-text)' }}>{(apt.tot_supply_hshld_co ?? 0).toLocaleString()}세대</strong></span>
                    <span>📅 청약 <strong style={{ color: 'var(--kd-text)' }}>{fmtDate(apt.rcept_bgnde)} ~ {fmtDate(apt.rcept_endde)}</strong></span>
                    {apt.mvn_prearnge_ym && <span>🔑 입주 <strong style={{ color: 'var(--kd-text)' }}>{apt.mvn_prearnge_ym}</strong></span>}
                  </div>
                </div>

                <span style={{ fontSize: 18, color: 'var(--kd-text-dim)', flexShrink: 0, marginLeft: 8 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>

              {/* 상세 정보 (펼치기) */}
              {isOpen && (
                <div style={{
                  borderTop: '1px solid var(--kd-border)',
                  padding: '14px 16px',
                  background: 'var(--kd-surface)',
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 12, marginBottom: 14,
                  }}>
                    {[
                      { label: '특별공급 접수', value: apt.spsply_rcept_bgnde ? `${fmtDate(apt.spsply_rcept_bgnde)} ~ ${fmtDate(apt.spsply_rcept_endde)}` : '-' },
                      { label: '당첨자 발표', value: fmtDate(apt.przwner_presnatn_de) },
                      { label: '계약 기간', value: apt.cntrct_cncls_bgnde ? `${fmtDate(apt.cntrct_cncls_bgnde)} ~ ${fmtDate(apt.cntrct_cncls_endde)}` : '-' },
                      { label: '입주 예정', value: apt.mvn_prearnge_ym || '-' },
                      { label: '공급 유형', value: apt.mdatrgbn_nm || '-' },
                      { label: '총 공급 세대', value: (apt.tot_supply_hshld_co ?? 0).toLocaleString() + '세대' },
                    ].map(item => (
                      <div key={item.label} style={{
                        background: 'var(--kd-border)', borderRadius: 4, padding: '10px 12px',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--kd-text-dim)', marginBottom: 4, fontWeight: 600 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kd-text)' }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  {apt.pblanc_url && (
                    <a href={apt.pblanc_url} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#FF4500', color: '#fff',
                      padding: '8px 16px', borderRadius: 20,
                      fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    }}>
                      청약홈에서 자세히 보기 →
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{
            background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
            borderRadius: 4, padding: '40px 0', textAlign: 'center', color: 'var(--kd-text-dim)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
            <div>해당 조건의 청약 정보가 없습니다</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--kd-text-dim)', textAlign: 'right' }}>
        * 국토교통부 청약홈 공공데이터 기준 · 매일 자동 갱신
      </div>
    </div>
  );
}