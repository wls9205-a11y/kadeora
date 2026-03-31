'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DailyReportData } from '@/lib/daily-report-data';
import { useAuth } from '@/components/AuthProvider';

interface Props {
  data: DailyReportData;
  regions: string[];
  viewDate?: string | null;   // 아카이브 모드 (null = 오늘 실시간)
  prevDate?: string | null;
  nextDate?: string | null;
}

function fmt(n: number) { return n >= 10000 ? (n / 10000).toFixed(1) + '억' : n.toLocaleString() + '만'; }
function fmtB(n: number) { return n >= 1e12 ? (n / 1e12).toFixed(1) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(0) + 'B' : n.toLocaleString(); }
function pctColor(v: number | null) { return !v ? 'var(--text-tertiary)' : v > 0 ? 'var(--accent-red)' : 'var(--text-brand)'; }
function pctStr(v: number | null) { return v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }

// VIP Gold 컬러 팔레트
const G = {
  gold: '#D4A853',
  goldLight: '#E8C778',
  goldDark: '#B8942E',
  goldBg: 'rgba(212,168,83,0.06)',
  goldBorder: 'rgba(212,168,83,0.18)',
  goldGlow: 'rgba(212,168,83,0.12)',
  gradientBorder: 'linear-gradient(135deg, rgba(212,168,83,0.4) 0%, rgba(184,148,46,0.15) 50%, rgba(212,168,83,0.4) 100%)',
  gradientHero: 'linear-gradient(145deg, var(--bg-surface) 0%, rgba(212,168,83,0.04) 40%, var(--bg-surface) 100%)',
};

const SH = ({ icon, title }: { icon: string; title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', margin: '20px 0 10px' }}>
    <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg, ${G.gold} 0%, ${G.goldDark} 100%)` }} />
    <span style={{ fontSize: 16 }}>{icon}</span>
    <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.3 }}>{title}</span>
  </div>
);

export default function DailyReportClient({ data, regions, viewDate, prevDate, nextDate }: Props) {
  const router = useRouter();
  const { userId, profile, loading: authLoading } = useAuth();
  const d = data;
  const isArchive = !!viewDate;

  const displayDate = viewDate ? new Date(viewDate) : new Date();
  const now = displayDate; // 체크포인트 계산용
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = `${displayDate.getFullYear()}.${String(displayDate.getMonth() + 1).padStart(2, '0')}.${String(displayDate.getDate()).padStart(2, '0')} ${dayNames[displayDate.getDay()]}`;

  const localUnsoldUnits = d.unsoldLocal.reduce((s, r) => s + r.units, 0);
  const localUnsoldPct = d.unsoldUnits > 0 ? Math.round(localUnsoldUnits / d.unsoldUnits * 1000) / 10 : 0;

  // 섹터: 상승/하락 카운트
  const sectorUp = d.sectors.filter(s => s.avg_pct > 0).length;
  const sectorDn = d.sectors.filter(s => s.avg_pct <= 0).length;

  // TOP 10 주간 상승/하락 카운트
  const weekUp = d.stockTop10.filter(s => (s.week_pct ?? 0) > 0).length;
  const weekDn = d.stockTop10.filter(s => (s.week_pct ?? 0) < 0).length;

  const maxGu = d.guPrices[0]?.sale || 1;

  // 날짜 네비게이션 핸들러
  const goToDate = (date: string) => router.push(`/daily/${encodeURIComponent(d.region)}/${date}`);
  const goToToday = () => router.push(`/daily/${encodeURIComponent(d.region)}`);
  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) goToDate(e.target.value);
  };

  // ═══ 회원전용 게이트 (SSR은 유지 → SEO 노출, 클라이언트만 차단) ═══
  const isGated = !authLoading && (!userId || !profile?.regionText);
  const gateReason = !userId ? 'login' : 'region';

  if (isGated) {
    return (
      <div>
        {/* 게이트 카드 */}
        <div style={{
          padding: '24px 20px', borderRadius: 'var(--radius-card)',
          background: G.gradientHero, border: `1.5px solid ${G.goldBorder}`,
          position: 'relative', overflow: 'hidden', textAlign: 'center',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${G.goldDark}, ${G.gold}, ${G.goldLight}, ${G.gold}, ${G.goldDark})` }} />

          {/* 골드 로고 */}
          <div style={{ margin: '0 auto 14px', width: 40, height: 40 }}>
            <svg width="40" height="40" viewBox="0 0 72 72"><defs><linearGradient id="rg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0F1B3E"/><stop offset="100%" stopColor="#2563EB"/></linearGradient></defs><rect x="2" y="2" width="68" height="68" rx="16" fill="url(#rg3)" stroke="#D4A853" strokeWidth="4"/><circle cx="18" cy="36" r="6" fill="white"/><circle cx="36" cy="36" r="6" fill="white"/><circle cx="54" cy="36" r="6" fill="white"/></svg>
          </div>

          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            {gateReason === 'login' ? '회원 전용 리포트입니다' : '거주지 등록이 필요합니다'}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 16 }}>
            {gateReason === 'login'
              ? '카더라 데일리 리포트는 회원만 열람할 수 있습니다.\n3초 가입 후 매일 아침 투자 브리핑을 받아보세요.'
              : '내 지역 맞춤 리포트를 받으려면 거주지를 등록해 주세요.\n프로필에서 시/도, 시/군/구를 선택하면 바로 읽을 수 있습니다.'}
          </div>
          {gateReason === 'login' ? (
            <Link href={`/login?redirect=${encodeURIComponent(`/daily/${encodeURIComponent(d.region)}`)}`} style={{
              display: 'inline-block', padding: '12px 32px', borderRadius: 'var(--radius-xl)',
              background: `linear-gradient(135deg, ${G.gold}, ${G.goldDark})`, color: '#fff',
              fontSize: 'var(--fs-base)', fontWeight: 700, textDecoration: 'none',
              boxShadow: `0 2px 12px rgba(212,168,83,0.4)`,
            }}>카카오로 3초 가입</Link>
          ) : (
            <Link href={`/profile/${userId}`} style={{
              display: 'inline-block', padding: '12px 32px', borderRadius: 'var(--radius-xl)',
              background: `linear-gradient(135deg, ${G.gold}, ${G.goldDark})`, color: '#fff',
              fontSize: 'var(--fs-base)', fontWeight: 700, textDecoration: 'none',
              boxShadow: `0 2px 12px rgba(212,168,83,0.4)`,
            }}>거주지 등록하기</Link>
          )}

          {/* 리포트 미리보기 힌트 */}
          <div style={{ marginTop: 20, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}` }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: G.gold, fontWeight: 600, marginBottom: 4 }}>✦ 오늘 리포트 미리보기</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              {dateLabel} · #{d.issueNo}호 · {d.region} 투자 브리핑<br/>
              시총 TOP 10 · 섹터 히트맵 · 청약 {d.subCountThisWeek}건 · 미분양 {d.unsoldUnits.toLocaleString()}세대
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 아카이브 모드 배너 */}
      {isArchive && (
        <div style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}`, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: G.gold }}>📂 {viewDate} 아카이브</span>
          <button onClick={goToToday} style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: G.gold, background: 'none', border: `1px solid ${G.goldBorder}`, borderRadius: 'var(--radius-xs)', padding: '3px 10px', cursor: 'pointer' }}>오늘 보기 →</button>
        </div>
      )}

      {/* ═══ HERO — 회원전용 Premium ═══ */}
      <div style={{
        padding: '18px 16px', borderRadius: 'var(--radius-card)',
        background: G.gradientHero,
        border: `1px solid ${G.goldBorder}`,
        marginBottom: 'var(--sp-sm)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 데코 골드 라인 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent 0%, ${G.gold} 30%, ${G.goldLight} 50%, ${G.gold} 70%, transparent 100%)` }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: G.gold, letterSpacing: 1.5, textTransform: 'uppercase' }}>KADEORA DAILY REPORT</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: G.goldBg, padding: '2px 8px', borderRadius: 3, border: `1px solid ${G.goldBorder}` }}>#{d.issueNo}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
              {isArchive ? '투자 브리핑 아카이브' : '오늘의 투자 브리핑'}
            </div>
          </div>
          <select
            value={d.region}
            onChange={e => {
              const base = `/daily/${encodeURIComponent(e.target.value)}`;
              router.push(viewDate ? `${base}/${viewDate}` : base);
            }}
            style={{ fontSize: 12, fontWeight: 700, color: G.gold, background: G.goldBg, border: `1px solid ${G.goldBorder}`, borderRadius: 'var(--radius-xs)', padding: '4px 10px', cursor: 'pointer' }}
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* 날짜 네비게이션 — 골드 라인 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${G.goldBorder}`, marginBottom: 6 }}>
          <button
            onClick={() => prevDate && goToDate(prevDate)}
            disabled={!prevDate}
            style={{ fontSize: 12, fontWeight: 700, color: prevDate ? G.gold : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: prevDate ? 'pointer' : 'default', padding: '4px 8px' }}
          >◀ 이전</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{dateLabel}</span>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <input
                type="date"
                onChange={handleDateInput}
                defaultValue={viewDate || undefined}
                max={new Date().toISOString().slice(0, 10)}
                min="2026-01-06"
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
            </label>
          </div>

          <button
            onClick={() => nextDate ? goToDate(nextDate) : (!isArchive ? undefined : goToToday())}
            disabled={!nextDate && !isArchive}
            style={{ fontSize: 12, fontWeight: 700, color: (nextDate || isArchive) ? G.gold : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: (nextDate || isArchive) ? 'pointer' : 'default', padding: '4px 8px' }}
          >{nextDate ? '다음 ▶' : isArchive ? '오늘 ▶' : '최신'}</button>
        </div>

        {/* 어젯밤 달라진 것 — 골드 */}
        <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}`, marginBottom: 'var(--sp-sm)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: G.gold, marginBottom: 'var(--sp-xs)' }}>✦ 어젯밤 달라진 것</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-xs)' }}>
            {d.stockTop10.slice(0, 4).filter(s => s.week_pct != null && s.week_pct !== 0).map(s => (
              <span key={s.symbol} style={{
                fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-xs)',
                background: (s.week_pct ?? 0) > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                color: pctColor(s.week_pct),
              }}>
                {s.name} {pctStr(s.week_pct)}/주
              </span>
            ))}
            {d.subscriptions.filter(s => s.status === '예정' && s.rcept_bgnde === d.date).map(s => (
              <span key={s.house_nm} style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: 'rgba(251,146,60,0.08)', color: 'var(--accent-yellow)' }}>
                {s.house_nm.slice(0, 10)} 오늘 접수시작
              </span>
            ))}
          </div>
        </div>

        {/* KPI 스트립 */}
        <div className="kd-kpi-5">
          {[
            { v: d.subCountThisWeek + '건', l: '이번주 청약', s: d.subUnitsThisWeek.toLocaleString() + '세대', sc: 'var(--text-secondary)' },
            { v: d.unsoldUnits.toLocaleString(), l: '전국 미분양', s: `${d.region} ${localUnsoldPct}%`, sc: localUnsoldPct < 5 ? 'var(--accent-green)' : 'var(--accent-red)' },
            { v: d.redevTotal + '건', l: `${d.region} 재개발`, s: `재건축 ${d.redevRebuild}`, sc: 'var(--text-tertiary)' },
            { v: (sectorUp > sectorDn ? '+' : '') + d.sectors[0]?.avg_pct + '%', l: d.sectors[0]?.sector || '', s: sectorUp + '↑ ' + sectorDn + '↓', sc: 'var(--text-secondary)' },
            { v: d.guPrices[0] ? fmt(d.guPrices[0].sale) : '-', l: d.guPrices[0]?.sigungu + ' 매매', s: '전세율 ' + (d.guPrices[0]?.jeonse_ratio || '-') + '%', sc: 'var(--text-secondary)' },
          ].map((k, i) => (
            <div key={i} style={{ background: G.goldBg, borderRadius: 'var(--radius-sm)', padding: '10px 6px', textAlign: 'center', border: `1px solid ${G.goldBorder}` }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: G.goldLight }}>{k.v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{k.l}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: k.sc, marginTop: 1 }}>{k.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ S1: 주식 시장 ═══ */}
      <SH icon="📈" title="국내 시장 · 시총 TOP 10" />
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 8 }}>
        <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>#</th>
              <th style={{ textAlign: 'left', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>종목</th>
              <th style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>현재가</th>
              <th style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>전주比</th>
              <th style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>시총</th>
            </tr>
          </thead>
          <tbody>
            {d.stockTop10.map((s, i) => (
              <tr key={s.symbol} style={{ borderBottom: i < 9 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '6px 4px', color: 'var(--text-tertiary)' }}>{i + 1}</td>
                <td style={{ padding: '6px 4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 3 }}>{s.sector}</span>
                </td>
                <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--text-primary)' }}>{Number(s.price).toLocaleString()}</td>
                <td style={{ textAlign: 'right', padding: '6px 4px' }}>
                  {s.week_ago ? (
                    <span style={{ color: pctColor(s.week_pct), fontWeight: 600 }}>
                      {pctStr(s.week_pct)}
                    </span>
                  ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {s.market_cap > 1e15 ? Math.round(s.market_cap / 1e12) + '조' : Math.round(s.market_cap / 1e12) + '조'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)', textAlign: 'right' }}>
          전주比 상승 {weekUp} · 하락 {weekDn} · 보합 {10 - weekUp - weekDn}
        </div>
      </div>

      {/* 섹터 히트맵 */}
      <SH icon="🗂️" title={`섹터 히트맵 (${d.sectors.length}개)`} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
        {d.sectors.slice(0, 14).map(s => {
          const isUp = s.avg_pct > 0;
          return (
            <div key={s.sector} style={{
              padding: '4px 6px', borderRadius: 'var(--radius-xs)', textAlign: 'center', minWidth: 48,
              background: isUp ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)',
              border: `1px solid ${isUp ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.sector}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: pctColor(s.avg_pct) }}>{pctStr(s.avg_pct)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.cap_t}조</div>
            </div>
          );
        })}
      </div>

      {/* 지수 & 환율 */}
      {(d.indices?.length > 0 || d.exchangeRate > 0) && (
        <>
          <SH icon="📊" title="지수 & 환율" />
          <div className="kd-grid-6" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min((d.indices?.length || 0) + (d.exchangeRate > 0 ? 1 : 0), 5)}, 1fr)`, gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
            {(d.indices || []).map(idx => {
              const isKr = idx.label === 'KOSPI' || idx.label === 'KOSDAQ';
              const color = idx.change_pct > 0 ? (isKr ? 'var(--accent-red)' : 'var(--accent-green)') : idx.change_pct < 0 ? (isKr ? 'var(--accent-blue)' : 'var(--accent-red)') : 'var(--text-tertiary)';
              return (
                <div key={idx.label} style={{ background: G.goldBg, borderRadius: 'var(--radius-sm)', padding: '6px 4px', textAlign: 'center', border: `1px solid ${G.goldBorder}`, borderLeft: `3px solid ${color}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx.label}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{idx.label.includes('S&P') || idx.label === 'NASDAQ' ? Number(idx.value).toLocaleString('en', { maximumFractionDigits: 0 }) : fmt(idx.value)}</div>
                  {idx.change_pct !== 0 && <div style={{ fontSize: 9, color, fontWeight: 700 }}>{idx.change_pct > 0 ? '▲' : '▼'}{Math.abs(idx.change_pct).toFixed(2)}%</div>}
                </div>
              );
            })}
            {d.exchangeRate > 0 && (
              <div style={{ background: G.goldBg, borderRadius: 'var(--radius-sm)', padding: '6px 4px', textAlign: 'center', border: `1px solid ${G.goldBorder}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>USD/KRW</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>₩{d.exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 글로벌 */}
      <SH icon="🌎" title="글로벌 마켓" />
      <div className="kd-grid-6" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(d.globalStocks.length, 6)}, 1fr)`, gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
        {d.globalStocks.slice(0, 6).map(s => {
          const pct = s.change_pct ?? 0;
          const color = pct > 0 ? 'var(--accent-green)' : pct < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)';
          return (
            <div key={s.symbol} style={{ background: G.goldBg, borderRadius: 'var(--radius-sm)', padding: '6px 4px', textAlign: 'center', border: `1px solid ${G.goldBorder}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G.gold }}>{s.symbol}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>${Number(s.price).toFixed(0)}</div>
              {pct !== 0 && <div style={{ fontSize: 9, color, fontWeight: 700 }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>}
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>${fmtB(s.market_cap)}</div>
            </div>
          );
        })}
      </div>

      {/* ═══ S2: 청약 캘린더 ═══ */}
      <SH icon="🏗️" title="이번주 청약 캘린더" />
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 8 }}>
        {d.subscriptions.filter(s => s.status !== '마감').length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 16 }}>이번주 청약 일정이 없습니다.</div>
        ) : (
          d.subscriptions.filter(s => s.status !== '마감').map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--sp-sm)', padding: '8px 0', borderBottom: i < d.subscriptions.filter(s => s.status !== '마감').length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 42, textAlign: 'center', flexShrink: 0, borderRight: '1px solid var(--border)', paddingRight: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{new Date(s.rcept_bgnde).getDate()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(new Date(s.rcept_bgnde).getMonth() + 1)}월</div>
                {s.rcept_bgnde === d.date && <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-red)' }}>TODAY</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>{s.house_nm}</span>
                  <span style={{
                    fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-xs)',
                    background: s.status === '접수중' ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
                    color: s.status === '접수중' ? 'var(--accent-green)' : 'var(--text-brand)',
                  }}>{s.status}</span>
                  {s.region_nm === d.region && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-yellow)' }}>내 지역</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {s.region_nm} · {s.tot_supply_hshld_co.toLocaleString()}세대 · {s.constructor_nm?.split('(')[0]}
                  {s.price_per_pyeong_avg ? ` · 평당 ${s.price_per_pyeong_avg >= 10000 ? (s.price_per_pyeong_avg / 10000).toFixed(0) + '억' : s.price_per_pyeong_avg.toLocaleString() + '만'}` : ''}
                  {' '}~{s.rcept_endde.slice(5)}
                </div>
              </div>
            </div>
          ))
        )}
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)', textAlign: 'right' }}>
          이번주 총 {d.subCountThisWeek}건 · {d.subUnitsThisWeek.toLocaleString()}세대
        </div>
      </div>

      {/* ═══ S3: 구별 시세 ═══ */}
      {d.guPrices.length > 0 && (
        <>
          <SH icon="🏢" title={`${d.region} 아파트 시세 (${d.guPrices.length}개 구/시)`} />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 8 }}>
            {d.guPrices.slice(0, 12).map((g, i) => {
              const salePct = Math.round(g.sale / maxGu * 100);
              const jonsePct = Math.round(g.jeonse / maxGu * 100);
              return (
                <div key={g.sigungu} style={{ marginBottom: i < Math.min(d.guPrices.length, 12) - 1 ? 6 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', marginBottom: 3 }}>
                    <span style={{ fontWeight: i < 3 ? 700 : 500, color: i < 3 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{g.sigungu}</span>
                    <span>
                      <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{fmt(g.sale)}</span>
                      <span style={{ color: 'var(--text-tertiary)', margin: '0 3px' }}>·</span>
                      <span style={{ color: 'var(--text-brand)' }}>{fmt(g.jeonse)}</span>
                      <span style={{ color: g.jeonse_ratio >= 68 ? 'var(--accent-green)' : 'var(--text-tertiary)', marginLeft: 4, fontSize: 12 }}>{g.jeonse_ratio}%</span>
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', height: '100%', width: `${salePct}%`, borderRadius: 2, background: 'rgba(239,68,68,0.25)' }} />
                    <div style={{ position: 'absolute', height: '100%', width: `${jonsePct}%`, borderRadius: 2, background: 'rgba(59,130,246,0.35)' }} />
                  </div>
                </div>
              );
            })}
            {d.guPrices.length > 12 && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                {d.guPrices.slice(12).map(g => `${g.sigungu} ${fmt(g.sale)}`).join(' · ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 4, borderRadius: 2, background: 'rgba(239,68,68,0.3)', marginRight: 2 }} />매매</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 4, borderRadius: 2, background: 'rgba(59,130,246,0.4)', marginRight: 2 }} />전세</span>
              <span>전세율 <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>68%+</span> = 갭투자 유리</span>
            </div>
          </div>
        </>
      )}

      {/* ═══ S4: 미분양 + 재개발 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <SH icon="🏚️" title="미분양" />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div><span style={{ fontSize: 16, fontWeight: 800 }}>{d.unsoldUnits.toLocaleString()}</span><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>세대</span></div>
              <span style={{ fontSize: 10, fontWeight: 600, color: localUnsoldPct < 5 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {d.region} {localUnsoldPct}%
              </span>
            </div>
            {d.unsoldByRegion.slice(0, 4).map((r, i) => {
              const mx = d.unsoldByRegion[0]?.units || 1;
              return (
                <div key={r.region_nm} style={{ marginBottom: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: r.region_nm === d.region ? 'var(--brand)' : 'var(--text-secondary)', fontWeight: r.region_nm === d.region ? 700 : 400 }}>{r.region_nm}</span>
                    <span style={{ fontWeight: 600, color: i === 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{r.units.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(r.units / mx * 100)}%`, borderRadius: 2, background: r.region_nm === d.region ? 'var(--brand)' : i === 0 ? 'var(--accent-red)' : 'var(--text-tertiary)' }} />
                  </div>
                </div>
              );
            })}
            {d.unsoldLocal.length > 0 && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{d.region} TOP</span>: {d.unsoldLocal.slice(0, 3).map(r => `${r.sigungu} ${r.units}`).join(' · ')}
              </div>
            )}
          </div>
        </div>

        <div>
          <SH icon="🔨" title={`${d.region} 재개발`} />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 'var(--sp-xs)' }}>
              {d.redevTotal}건 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>재개발 {d.redevTotal - d.redevRebuild} · 재건축 {d.redevRebuild}</span>
            </div>
            {d.redevStages.length > 0 && (
              <div style={{ display: 'flex', gap: 1, marginBottom: 'var(--sp-xs)' }}>
                {d.redevStages.map((st, i) => {
                  const total = d.redevStages.reduce((s, x) => s + x.cnt, 0);
                  const colors = ['var(--text-tertiary)', 'var(--text-brand)', '#7C3AED', 'var(--accent-yellow)', 'var(--accent-green)', 'var(--accent-green)'];
                  return (
                    <div key={st.stage} style={{
                      flex: Math.max(st.cnt / total, 0.08), height: 16, borderRadius: 2,
                      background: colors[i] || 'var(--text-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#fff',
                    }}>{st.cnt}</div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              {d.redevStages.map(s => `${s.stage} ${s.cnt}`).join(' · ')}
            </div>
            {d.redevMajor.length > 0 && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-xs)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>재건축</span>: {d.redevMajor.slice(0, 5).join(' · ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ S5: 요약 + 내일 체크포인트 — 회원전용 골드 ═══ */}
      <SH icon="📋" title="오늘의 요약 + 내일 체크포인트" />
      <div className="report-summary" style={{
        background: `linear-gradient(145deg, var(--bg-surface) 0%, rgba(212,168,83,0.04) 100%)`,
        borderRadius: 'var(--radius-card)',
        border: `2px solid ${G.gold}`,
        padding: '16px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 상단 골드 라인 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${G.goldDark}, ${G.gold}, ${G.goldLight}, ${G.gold}, ${G.goldDark})` }} />
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 2, marginBottom: 'var(--sp-md)' }}>

          {/* 주식 시장 요약 */}
          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 주식 시장</div>
            국내 <Link href="/stock" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>시총 TOP 10</Link> 종목 중 <b style={{ color: 'var(--accent-red)' }}>{weekUp}개 종목이 상승</b>, <b style={{ color: 'var(--accent-blue)' }}>{weekDn}개 종목이 하락</b>했습니다.
            {d.sectors[0] && <> 섹터별로는 <Link href={`/stock/sector/${encodeURIComponent(d.sectors[0].sector)}`} style={{ color: pctColor(d.sectors[0].avg_pct), textDecoration: 'none', fontWeight: 700 }}>{d.sectors[0].sector}</Link> 섹터가 <span style={{ color: pctColor(d.sectors[0].avg_pct), fontWeight: 700 }}>{pctStr(d.sectors[0].avg_pct)}</span>로 가장 강한 흐름을 보였습니다.</>}
            {' '}전체 {d.sectors.length}개 섹터 가운데 <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{sectorUp}개 상승</span>, <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{sectorDn}개 하락</span>하며 {sectorUp > sectorDn ? '시장 전반에 매수 심리가 우세한' : sectorUp === sectorDn ? '관망세가 짙은' : '매도 압력이 강한'} 장세를 보이고 있습니다.
            {d.stockTop10[0] && <> 시총 1위 <Link href={`/stock/${d.stockTop10[0].symbol}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 700 }}>{d.stockTop10[0].name}</Link>은 현재 <b style={{ color: 'var(--text-primary)' }}>{Number(d.stockTop10[0].price).toLocaleString()}원</b>{d.stockTop10[0].week_pct != null && d.stockTop10[0].week_pct !== 0 ? <>, 주간 <span style={{ color: pctColor(d.stockTop10[0].week_pct), fontWeight: 700 }}>{pctStr(d.stockTop10[0].week_pct)}</span>의 변동을 기록</> : ''}하고 있습니다.</>}
            {d.globalStocks.length > 0 && <> 해외 시장에서는 {d.globalStocks.slice(0, 3).map((s, i) => <span key={s.symbol}>{i > 0 && ', '}<Link href={`/stock/${s.symbol}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>{s.symbol}</Link> ${Number(s.price).toFixed(0)}{s.change_pct ? <span style={{ color: s.change_pct > 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: 11 }}>({s.change_pct > 0 ? '+' : ''}{s.change_pct.toFixed(1)}%)</span> : ''}</span>)} 수준에서 거래되고 있습니다.</>}
            {d.exchangeRate > 0 && <> 원/달러 환율은 <b style={{ color: 'var(--text-primary)' }}>₩{d.exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</b>입니다.</>}
          </div>

          {/* 청약 시장 요약 */}
          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 청약 시장</div>
            이번 주 전국 <Link href="/apt" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 700 }}>{d.subCountThisWeek}건</Link>의 아파트 청약이 예정되어 있으며, 총 <b style={{ color: 'var(--text-primary)' }}>{d.subUnitsThisWeek.toLocaleString()}세대</b> 규모입니다.
            {d.subscriptions.filter(s => s.status === '접수중').length > 0 && <> 현재 접수가 진행 중인 단지는 <b style={{ color: 'var(--text-primary)' }}>{d.subscriptions.filter(s => s.status === '접수중').length}건</b>으로, {d.subscriptions.filter(s => s.status === '접수중').slice(0, 2).map(s => s.house_nm).join(', ')} 등이 있습니다.</>}
            {d.subscriptions.filter(s => s.rcept_bgnde === d.date).length > 0 && <> 오늘 접수가 시작되는 단지로는 <b style={{ color: 'var(--accent-red)' }}>{d.subscriptions.filter(s => s.rcept_bgnde === d.date).map(s => s.house_nm).join(', ')}</b>이(가) 있으니 관심 있는 분은 일정을 확인해 보시기 바랍니다.</>}
            {d.subscriptions.filter(s => s.status === '접수중').length === 0 && d.subscriptions.filter(s => s.rcept_bgnde === d.date).length === 0 && <> 이번 주 남은 접수 일정을 확인하고 관심 단지를 미리 체크해 두시는 것을 권장합니다.</>}
          </div>

          {/* 미분양 현황 */}
          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 미분양 현황</div>
            전국 <Link href="/apt?tab=unsold" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>미분양 아파트</Link>는 총 <b style={{ color: localUnsoldPct > 8 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{d.unsoldUnits.toLocaleString()}세대</b>입니다. <Link href={`/apt/region/${encodeURIComponent(d.region)}`} style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>{d.region}</Link> 지역의 미분양은 <b style={{ color: 'var(--text-primary)' }}>{localUnsoldUnits.toLocaleString()}세대</b>로 전국 대비 <span style={{ color: localUnsoldPct < 3 ? 'var(--accent-green)' : localUnsoldPct > 8 ? 'var(--accent-red)' : 'var(--text-primary)', fontWeight: 700 }}>{localUnsoldPct}%</span>를 차지하고 있습니다.
            {localUnsoldPct < 3 ? ` ${d.region}은 미분양 비중이 매우 낮아 수요가 안정적인 지역으로 평가됩니다.` : localUnsoldPct < 8 ? ` ${d.region}의 미분양 비중은 보통 수준이며, 신규 분양 시 수요 분석이 필요합니다.` : ` ${d.region}의 미분양 비중이 다소 높아 분양 시장 주의가 필요합니다.`}
            {d.unsoldLocal.length > 0 && <> 지역 내 주요 미분양 집중 지역은 {d.unsoldLocal.slice(0, 3).map(u => `${u.sigungu}(${u.units}세대)`).join(', ')} 순입니다.</>}
          </div>

          {/* 재개발 동향 */}
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 재개발·재건축</div>
            <Link href={`/apt/region/${encodeURIComponent(d.region)}`} style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>{d.region}</Link> 지역에서는 현재 총 <Link href="/apt?tab=redev" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 700 }}>{d.redevTotal}건</Link>의 정비사업이 진행 중입니다.
            {d.redevStages[0] && <> 단계별로는 {d.redevStages[0].stage}이 {d.redevStages[0].cnt}건({d.redevTotal > 0 ? Math.round((d.redevStages[0].cnt || 0) / d.redevTotal * 100) : 0}%)으로 가장 많으며</>}
            {d.redevStages[1] && <>, {d.redevStages[1].stage} {d.redevStages[1].cnt}건이 뒤를 잇고 있습니다</>}.
            {d.redevRebuild > 0 && <> 이 중 재건축 사업은 {d.redevRebuild}건이며, 나머지는 재개발로 분류됩니다.</>}
            {' '}정비사업 진행 현황은 입주권·분양권 투자 판단의 핵심 지표이므로 단계별 변동을 지속적으로 모니터링하시기 바랍니다.
          </div>
        </div>

        {/* 내일 체크포인트 — 골드 */}
        <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}` }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 내일 체크포인트</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {d.subscriptions.filter(s => s.status === '접수중').map(s => `• ${s.house_nm} 마감 D-${Math.max(0, Math.ceil((new Date(s.rcept_endde).getTime() - now.getTime()) / 86400000))}`).slice(0, 3).join('\n').split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
            {d.subscriptions.filter(s => {
              const tmr = new Date(now);
              tmr.setDate(tmr.getDate() + 1);
              return s.rcept_bgnde === tmr.toISOString().slice(0, 10);
            }).map(s => `• ${s.house_nm} 내일 접수시작`).map((l, i) => <span key={'t' + i}>{l}<br /></span>)}
            • 주식 섹터 추이 연속 확인 — {d.sectors[0]?.sector} {d.sectors[0]?.avg_pct > 0 ? '상승 지속?' : '반등?'}
          </div>
        </div>

      </div>

      {/* 푸터 — 리포트 소개 */}
      <div style={{ marginTop: 'var(--sp-md)', padding: '14px 16px', borderRadius: 'var(--radius-card)', background: G.goldBg, border: `1px solid ${G.goldBorder}` }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <span style={{ color: G.gold, fontWeight: 700 }}>발행</span> 매일 오전 7시 (평일) · 주말판 토요일 오전 발행<br/>
          <span style={{ color: G.gold, fontWeight: 700 }}>내용</span> 국내외 <Link href="/stock" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>주식 시황</Link> · <Link href="/apt" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>청약 캘린더</Link> · <Link href="/apt?tab=unsold" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>미분양 현황</Link> · <Link href="/apt?tab=redev" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>재개발 동향</Link> · 시군구별 시세<br/>
          <span style={{ color: G.gold, fontWeight: 700 }}>대상</span> 카더라 회원 (거주지 등록 필수)
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '10px 0', marginTop: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        <span style={{ color: G.goldDark, fontWeight: 700, letterSpacing: 1 }}>KADEORA DAILY REPORT</span> #{d.issueNo}<br/>
        본 리포트는 투자 참고 자료이며 투자 권유가 아닙니다 · © 2026 kadeora.app
      </div>
    </div>
  );
}
