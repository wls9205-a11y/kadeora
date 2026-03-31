'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import type { DailyReportData } from '@/lib/daily-report-data';

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

const SH = ({ icon, title }: { icon: string; title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', margin: '18px 0 8px' }}>
    <span style={{ fontSize: 14 }}>{icon}</span>
    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
  </div>
);

export default function DailyReportClient({ data, regions, viewDate, prevDate, nextDate }: Props) {
  const router = useRouter();
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

  return (
    <div>
      {/* 아카이브 모드 배너 */}
      {isArchive && (
        <div style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-yellow)' }}>📂 {viewDate} 아카이브</span>
          <button onClick={goToToday} style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'none', border: '1px solid var(--brand)', borderRadius: 'var(--radius-xs)', padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>오늘 보기 →</button>
        </div>
      )}

      {/* ═══ HERO ═══ */}
      <div style={{ padding: '16px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', marginBottom: 'var(--sp-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>카더라 데일리 #{d.issueNo}</div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5 }}>{isArchive ? '투자 브리핑 아카이브' : '오늘의 투자 브리핑'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <select
              value={d.region}
              onChange={e => {
                const base = `/daily/${encodeURIComponent(e.target.value)}`;
                router.push(viewDate ? `${base}/${viewDate}` : base);
              }}
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* 날짜 네비게이션 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)', marginBottom: 6 }}>
          <button
            onClick={() => prevDate && goToDate(prevDate)}
            disabled={!prevDate}
            style={{ fontSize: 12, fontWeight: 700, color: prevDate ? 'var(--brand)' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: prevDate ? 'pointer' : 'default', fontFamily: 'inherit', padding: '4px 8px' }}
          >◀ 이전</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{dateLabel}</span>
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
            style={{ fontSize: 12, fontWeight: 700, color: (nextDate || isArchive) ? 'var(--brand)' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: (nextDate || isArchive) ? 'pointer' : 'default', fontFamily: 'inherit', padding: '4px 8px' }}
          >{nextDate ? '다음 ▶' : isArchive ? '오늘 ▶' : '최신'}</button>
        </div>

        {/* 어젯밤 달라진 것 */}
        <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-base)', border: '1px solid var(--border)', marginBottom: 'var(--sp-sm)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)' }}>어젯밤 달라진 것</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-xs)' }}>
            {d.stockTop10.slice(0, 4).filter(s => s.week_pct != null && s.week_pct !== 0).map(s => (
              <span key={s.symbol} style={{
                fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: (s.week_pct ?? 0) > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                color: pctColor(s.week_pct),
              }}>
                {s.name} {pctStr(s.week_pct)}/주
              </span>
            ))}
            {d.subscriptions.filter(s => s.status === '예정' && s.rcept_bgnde === d.date).map(s => (
              <span key={s.house_nm} style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(251,146,60,0.08)', color: 'var(--accent-yellow)' }}>
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
            <div key={i} style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{k.v}</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>{k.l}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: k.sc, marginTop: 1 }}>{k.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ S1: 주식 시장 ═══ */}
      <SH icon="📈" title="국내 시장 · 시총 TOP 10" />
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '10px 12px', marginBottom: 6 }}>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '4px 2px', color: 'var(--text-tertiary)', fontWeight: 600 }}>#</th>
              <th style={{ textAlign: 'left', padding: '4px 2px', color: 'var(--text-tertiary)', fontWeight: 600 }}>종목</th>
              <th style={{ textAlign: 'right', padding: '4px 2px', color: 'var(--text-tertiary)', fontWeight: 600 }}>현재가</th>
              <th style={{ textAlign: 'right', padding: '4px 2px', color: 'var(--text-tertiary)', fontWeight: 600 }}>전주比</th>
              <th style={{ textAlign: 'right', padding: '4px 2px', color: 'var(--text-tertiary)', fontWeight: 600 }}>시총</th>
            </tr>
          </thead>
          <tbody>
            {d.stockTop10.map((s, i) => (
              <tr key={s.symbol} style={{ borderBottom: i < 9 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '5px 2px', color: 'var(--text-tertiary)' }}>{i + 1}</td>
                <td style={{ padding: '5px 2px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 3 }}>{s.sector}</span>
                </td>
                <td style={{ textAlign: 'right', padding: '5px 2px', color: 'var(--text-primary)' }}>{Number(s.price).toLocaleString()}</td>
                <td style={{ textAlign: 'right', padding: '5px 2px' }}>
                  {s.week_ago ? (
                    <span style={{ color: pctColor(s.week_pct), fontWeight: 600 }}>
                      {pctStr(s.week_pct)}
                    </span>
                  ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                </td>
                <td style={{ textAlign: 'right', padding: '5px 2px', color: 'var(--text-tertiary)', fontSize: 10 }}>
                  {s.market_cap > 1e15 ? Math.round(s.market_cap / 1e12) + '조' : Math.round(s.market_cap / 1e12) + '조'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)', textAlign: 'right' }}>
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
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{s.sector}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: pctColor(s.avg_pct) }}>{pctStr(s.avg_pct)}</div>
              <div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{s.cap_t}조</div>
            </div>
          );
        })}
      </div>

      {/* 글로벌 */}
      <SH icon="🌎" title="글로벌 마켓" />
      <div className="kd-grid-6" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(d.globalStocks.length, 6)}, 1fr)`, gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
        {d.globalStocks.slice(0, 6).map(s => (
          <div key={s.symbol} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '6px 4px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{s.symbol}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>${Number(s.price).toFixed(0)}</div>
            <div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>${fmtB(s.market_cap)}</div>
          </div>
        ))}
      </div>

      {/* ═══ S2: 청약 캘린더 ═══ */}
      <SH icon="🏗️" title="이번주 청약 캘린더" />
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '10px 12px', marginBottom: 6 }}>
        {d.subscriptions.filter(s => s.status !== '마감').length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 16 }}>이번주 청약 일정이 없습니다.</div>
        ) : (
          d.subscriptions.filter(s => s.status !== '마감').map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--sp-sm)', padding: '8px 0', borderBottom: i < d.subscriptions.filter(s => s.status !== '마감').length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 42, textAlign: 'center', flexShrink: 0, borderRight: '1px solid var(--border)', paddingRight: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{new Date(s.rcept_bgnde).getDate()}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{(new Date(s.rcept_bgnde).getMonth() + 1)}월</div>
                {s.rcept_bgnde === d.date && <div style={{ fontSize: 8, fontWeight: 800, color: 'var(--accent-red)' }}>TODAY</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{s.house_nm}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                    background: s.status === '접수중' ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
                    color: s.status === '접수중' ? 'var(--accent-green)' : 'var(--text-brand)',
                  }}>{s.status}</span>
                  {s.region_nm === d.region && <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--accent-yellow)' }}>내 지역</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {s.region_nm} · {s.tot_supply_hshld_co.toLocaleString()}세대 · {s.constructor_nm?.split('(')[0]}
                  {s.price_per_pyeong_avg ? ` · 평당 ${s.price_per_pyeong_avg >= 10000 ? (s.price_per_pyeong_avg / 10000).toFixed(0) + '억' : s.price_per_pyeong_avg.toLocaleString() + '만'}` : ''}
                  {' '}~{s.rcept_endde.slice(5)}
                </div>
              </div>
            </div>
          ))
        )}
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)', textAlign: 'right' }}>
          이번주 총 {d.subCountThisWeek}건 · {d.subUnitsThisWeek.toLocaleString()}세대
        </div>
      </div>

      {/* ═══ S3: 구별 시세 ═══ */}
      {d.guPrices.length > 0 && (
        <>
          <SH icon="🏢" title={`${d.region} 아파트 시세 (${d.guPrices.length}개 구/시)`} />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '10px 12px', marginBottom: 6 }}>
            {d.guPrices.slice(0, 12).map((g, i) => {
              const salePct = Math.round(g.sale / maxGu * 100);
              const jonsePct = Math.round(g.jeonse / maxGu * 100);
              return (
                <div key={g.sigungu} style={{ marginBottom: i < Math.min(d.guPrices.length, 12) - 1 ? 6 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ fontWeight: i < 3 ? 700 : 500, color: i < 3 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{g.sigungu}</span>
                    <span>
                      <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{fmt(g.sale)}</span>
                      <span style={{ color: 'var(--text-tertiary)', margin: '0 3px' }}>·</span>
                      <span style={{ color: 'var(--text-brand)' }}>{fmt(g.jeonse)}</span>
                      <span style={{ color: g.jeonse_ratio >= 68 ? 'var(--accent-green)' : 'var(--text-tertiary)', marginLeft: 4, fontSize: 10 }}>{g.jeonse_ratio}%</span>
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
            <div style={{ display: 'flex', gap: 'var(--sp-sm)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
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
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '10px 12px' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
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
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{d.region} TOP</span>: {d.unsoldLocal.slice(0, 3).map(r => `${r.sigungu} ${r.units}`).join(' · ')}
              </div>
            )}
          </div>
        </div>

        <div>
          <SH icon="🔨" title={`${d.region} 재개발`} />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '10px 12px' }}>
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
                      fontSize: 8, fontWeight: 700, color: '#fff',
                    }}>{st.cnt}</div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              {d.redevStages.map(s => `${s.stage} ${s.cnt}`).join(' · ')}
            </div>
            {d.redevMajor.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 'var(--sp-xs)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>재건축</span>: {d.redevMajor.slice(0, 5).join(' · ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ S5: 요약 + 내일 체크포인트 ═══ */}
      <SH icon="📋" title="오늘의 요약 + 내일 체크포인트" />
      <div className="report-summary" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '12px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 'var(--sp-sm)' }}>
          <b style={{ color: 'var(--text-primary)' }}>주식</b>: TOP 10 중 상승 {weekUp}종목 · 하락 {weekDn}종목. {d.sectors[0]?.sector} 섹터 {pctStr(d.sectors[0]?.avg_pct || null)} 최고. {d.sectors.length}개 섹터 중 {sectorUp}개 상승 {sectorDn}개 하락.
          <br />
          <b style={{ color: 'var(--text-primary)' }}>청약</b>: 이번주 {d.subCountThisWeek}건({d.subUnitsThisWeek.toLocaleString()}세대).
          {d.subscriptions.filter(s => s.status === '접수중').length > 0 && ` 접수중 ${d.subscriptions.filter(s => s.status === '접수중').length}건.`}
          {d.subscriptions.filter(s => s.rcept_bgnde === d.date).length > 0 && ` 오늘 접수시작 ${d.subscriptions.filter(s => s.rcept_bgnde === d.date).map(s => s.house_nm).join(', ')}.`}
          <br />
          <b style={{ color: 'var(--text-primary)' }}>미분양</b>: 전국 {d.unsoldUnits.toLocaleString()}세대. {d.region} {localUnsoldUnits.toLocaleString()}세대({localUnsoldPct}%).
          <br />
          <b style={{ color: 'var(--text-primary)' }}>재개발</b>: {d.region} {d.redevTotal}건 중 {d.redevStages[0]?.stage} {d.redevStages[0]?.cnt}건({d.redevTotal > 0 ? Math.round((d.redevStages[0]?.cnt || 0) / d.redevTotal * 100) : 0}%).
          {d.redevRebuild > 0 && ` 재건축 ${d.redevRebuild}건.`}
        </div>

        {/* 내일 체크포인트 */}
        <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>내일 체크포인트</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {d.subscriptions.filter(s => s.status === '접수중').map(s => `• ${s.house_nm} 마감 D-${Math.max(0, Math.ceil((new Date(s.rcept_endde).getTime() - now.getTime()) / 86400000))}`).slice(0, 3).join('\n').split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
            {d.subscriptions.filter(s => {
              const tmr = new Date(now);
              tmr.setDate(tmr.getDate() + 1);
              return s.rcept_bgnde === tmr.toISOString().slice(0, 10);
            }).map(s => `• ${s.house_nm} 내일 접수시작`).map((l, i) => <span key={'t' + i}>{l}<br /></span>)}
            • 주식 섹터 추이 연속 확인 — {d.sectors[0]?.sector} {d.sectors[0]?.avg_pct > 0 ? '상승 지속?' : '반등?'}
          </div>
        </div>

        {/* 프리미엄 업셀 */}
        <div style={{ marginTop: 'var(--sp-sm)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--brand)', textAlign: 'center', fontSize: 11, color: 'var(--brand)' }}>
          💎 시세차익 계산 · 청약 등급 분석 · 주변 시세 비교 · 시나리오별 전략 → <b>카더라 프리미엄</b>
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ textAlign: 'center', padding: '14px 0', borderTop: '1px solid var(--border)', marginTop: 'var(--sp-lg)', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        카더라 데일리 #{d.issueNo} · 무료<br />
        매일 오전 7시 발행 · 본 리포트는 투자 참고 자료이며 투자 권유가 아닙니다<br />
        © 2026 kadeora.app · 부동산 · 주식 · 올인원
      </div>
    </div>
  );
}
