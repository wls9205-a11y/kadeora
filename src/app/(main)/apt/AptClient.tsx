'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';

interface Apt {
  id: number;
  house_nm: string;
  region_nm: string;
  hssply_adres: string;
  tot_supply_hshld_co: number;
  rcept_bgnde: string;
  rcept_endde: string;
  spsply_rcept_bgnde: string;
  spsply_rcept_endde: string;
  przwner_presnatn_de: string;
  cntrct_cncls_bgnde: string;
  cntrct_cncls_endde: string;
  mvn_prearnge_ym: string;
  pblanc_url: string;
  mdatrgbn_nm: string;
}

const REGIONS = ['전체','서울','경기','인천','부산','대구','광주','대전','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];

function getStatus(apt: Apt): 'open'|'upcoming'|'closed' {
  const today = new Date().toISOString().slice(0,10);
  if (!apt.rcept_bgnde) return 'upcoming';
  if (today >= apt.rcept_bgnde && today <= apt.rcept_endde) return 'open';
  if (today < apt.rcept_bgnde) return 'upcoming';
  return 'closed';
}

function getDday(apt: Apt): number | null {
  if (!apt.rcept_bgnde) return null;
  const today = new Date();
  const start = new Date(apt.rcept_bgnde);
  const diff = Math.ceil((start.getTime() - today.getTime()) / 86400000);
  return diff;
}

const STATUS_STYLE = {
  open:     { label: '접수중 🔥', bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success)' },
  upcoming: { label: '접수예정', bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning)' },
  closed:   { label: '마감', bg: 'var(--bg-hover)', color: 'var(--text-tertiary)', border: 'var(--border)' },
};

export default function AptClient({ apts }: { apts: Apt[] }) {
  const [region, setRegion] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number|null>(null);

  const filtered = useMemo(() => {
    return apts.filter(apt => {
      if (region !== '전체' && apt.region_nm !== region) return false;
      if (statusFilter !== '전체' && getStatus(apt) !== statusFilter) return false;
      if (search && !apt.house_nm?.includes(search) && !apt.hssply_adres?.includes(search)) return false;
      return true;
    });
  }, [apts, region, statusFilter, search]);

  const haptic = () => { try { if ('vibrate' in navigator) navigator.vibrate(10); } catch {} };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>🏠 아파트 청약 정보</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>전국 청약 일정을 한눈에 확인하세요</p>
      </div>

      {/* 검색 */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="단지명 또는 주소 검색"
          className="w-full px-4 py-2.5 rounded-xl text-sm"
          style={{
            backgroundColor: 'var(--bg-sunken)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        />
      </div>

      {/* 지역 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
        {REGIONS.map(r => (
          <button
            key={r}
            onClick={() => { haptic(); setRegion(r); }}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              backgroundColor: region === r ? 'var(--brand)' : 'var(--bg-hover)',
              color: region === r ? '#fff' : 'var(--text-secondary)',
              border: region === r ? 'none' : '1px solid var(--border)',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-5">
        {['전체','open','upcoming','closed'].map(s => (
          <button
            key={s}
            onClick={() => { haptic(); setStatusFilter(s); }}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: statusFilter === s ? 'var(--brand)' : 'var(--bg-hover)',
              color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
              border: statusFilter === s ? 'none' : '1px solid var(--border)',
            }}
          >
            {s === '전체' ? '전체' : s === 'open' ? '접수중' : s === 'upcoming' ? '예정' : '마감'}
          </button>
        ))}
      </div>

      {/* 리스트 */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>
            조건에 맞는 청약 정보가 없습니다
          </div>
        )}
        {filtered.map(apt => {
          const status = getStatus(apt);
          const ss = STATUS_STYLE[status];
          const dday = getDday(apt);
          const isOpen = expandedId === apt.id;

          return (
            <div
              key={apt.id}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {/* 카드 헤더 */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
                      >
                        {ss.label}
                      </span>
                      {status === 'upcoming' && dday !== null && dday >= 0 && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--brand-light)', color: 'var(--brand)' }}
                        >
                          D-{dday}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{apt.region_nm}</span>
                    </div>
                    <h2 className="font-bold text-base mt-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {apt.house_nm}
                    </h2>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {apt.hssply_adres}
                    </p>
                  </div>

                  {/* 공급 세대 */}
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black" style={{ color: 'var(--brand)' }}>
                      {apt.tot_supply_hshld_co?.toLocaleString()}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>세대</p>
                  </div>
                </div>

                {/* 접수 기간 */}
                {apt.rcept_bgnde && (
                  <div
                    className="mt-3 px-3 py-2 rounded-lg text-xs"
                    style={{ backgroundColor: 'var(--bg-sunken)', color: 'var(--text-secondary)' }}
                  >
                    📅 {apt.rcept_bgnde} ~ {apt.rcept_endde}
                  </div>
                )}

                {/* 액션 버튼 행 */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {/* ★ 현장토론방 버튼 — 청약 일정과 연동 */}
                  <Link
                    href={`/discussion/apt/${apt.id}`}
                    onClick={haptic}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: 'var(--success-bg)',
                      color: 'var(--success)',
                      border: '1px solid var(--success)',
                    }}
                  >
                    🏠 현장토론방
                  </Link>

                  {apt.pblanc_url && (
                    <a
                      href={apt.pblanc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={haptic}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--info-bg)',
                        color: 'var(--info)',
                        border: '1px solid var(--info)',
                      }}
                    >
                      청약홈 →
                    </a>
                  )}

                  <button
                    onClick={() => { haptic(); setExpandedId(isOpen ? null : apt.id); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-hover)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {isOpen ? '접기 ▲' : '상세보기 ▼'}
                  </button>
                </div>
              </div>

              {/* 상세 펼침 */}
              {isOpen && (
                <div
                  className="px-4 pb-4 border-t"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sunken)' }}
                >
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 text-xs">
                    {apt.spsply_rcept_bgnde && (
                      <><dt style={{ color: 'var(--text-tertiary)' }}>특별공급</dt>
                      <dd style={{ color: 'var(--text-primary)' }}>{apt.spsply_rcept_bgnde} ~ {apt.spsply_rcept_endde}</dd></>
                    )}
                    {apt.przwner_presnatn_de && (
                      <><dt style={{ color: 'var(--text-tertiary)' }}>당첨자발표</dt>
                      <dd style={{ color: 'var(--text-primary)' }}>{apt.przwner_presnatn_de}</dd></>
                    )}
                    {apt.cntrct_cncls_bgnde && (
                      <><dt style={{ color: 'var(--text-tertiary)' }}>계약</dt>
                      <dd style={{ color: 'var(--text-primary)' }}>{apt.cntrct_cncls_bgnde} ~ {apt.cntrct_cncls_endde}</dd></>
                    )}
                    {apt.mvn_prearnge_ym && (
                      <><dt style={{ color: 'var(--text-tertiary)' }}>입주예정</dt>
                      <dd style={{ color: 'var(--text-primary)' }}>{apt.mvn_prearnge_ym}</dd></>
                    )}
                    {apt.mdatrgbn_nm && (
                      <><dt style={{ color: 'var(--text-tertiary)' }}>공급지역</dt>
                      <dd style={{ color: 'var(--text-primary)' }}>{apt.mdatrgbn_nm}</dd></>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
