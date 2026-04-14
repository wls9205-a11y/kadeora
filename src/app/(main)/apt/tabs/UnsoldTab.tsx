'use client';
import LoginGate from '@/components/LoginGate';
import Link from 'next/link';
import SectionShareButton from '@/components/SectionShareButton';
import type { UnsoldApt } from '@/types/apt';
import { useState, useEffect } from 'react';
import { type SharedTabProps, generateAptSlug, isNew } from './apt-utils';
import dynamic from 'next/dynamic';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const MiniLineChart = dynamic(() => import('@/components/charts/MiniLineChart'), { ssr: false });

interface Props extends SharedTabProps {
  unsold: UnsoldApt[];
  unsoldMonthly: { stat_month: string; total_unsold: number; after_completion: number; region?: string }[];
  unsoldSummary: Record<string, any> | string | null;
  freshDate?: string;
}

export default function UnsoldTab({ unsold, unsoldMonthly, unsoldSummary, aptUser, watchlist, toggleWatchlist, setCommentTarget, showToast, globalRegion, globalSearch, freshDate, aptImageMap, aptEngageMap }: Props) {
  const [unsoldRegion, setUnsoldRegion] = useState(globalRegion || '전체');
  const [unsoldSearch, setUnsoldSearch] = useState('');
  const [unsoldPage, setUnsoldPage] = useState(1);
  const [surgeAlerts, setSurgeAlerts] = useState<{ region_nm: string; current_count: number; prev_count: number; change_pct: number }[]>([]);
  const effectiveSearch = globalSearch || unsoldSearch;

  useEffect(() => {
    setUnsoldRegion(globalRegion || '전체');
  }, [globalRegion]);

  // 미분양 급증 감지
  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.rpc('detect_unsold_surge').then(({ data }: { data: { region_nm: string; change_pct: number; current_count: number; prev_count: number }[] | null }) => {
      if (data?.length) setSurgeAlerts(data.slice(0, 5));
    });
  }, []);

  // 필터 변경 시 1페이지 리셋 (early return 전에 위치 — Rules of Hooks 준수)
  useEffect(() => { setUnsoldPage(1); }, [unsoldRegion, effectiveSearch]);

  const pill = (v: string, sel: string, set: (v: string) => void, label?: string) => (
    <button key={v} onClick={() => set(v)} style={{
      padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600,
      background: sel === v ? 'var(--brand)' : 'var(--bg-hover)',
      color: sel === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
      border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>
      {label || v}
    </button>
  );

  if (!unsold.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>🏚️ 미분양 데이터를 수집 중입니다<br/><span style={{ fontSize: 'var(--fs-sm)' }}>매월 국토교통부 통계 업데이트 시 반영됩니다</span></div>;
  const total = unsold.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
  const regs = ['전체', ...Array.from(new Set(unsold.map((u: Record<string, any>) => u.region_nm || '기타'))).sort()];
  const fu = (unsoldRegion === '전체' ? unsold : unsold.filter((u: Record<string, any>) => (u.region_nm || '기타') === unsoldRegion)).filter((u: Record<string, any>) => {
    if (!effectiveSearch) return true;
    const q = effectiveSearch.toLowerCase();
    return (u.house_nm || '').toLowerCase().includes(q) || (u.region_nm || '').toLowerCase().includes(q) || (u.sigungu_nm || '').toLowerCase().includes(q);
  });
  const UNSOLD_PER_PAGE = 30;
  const unsoldTotalPages = Math.ceil(fu.length / UNSOLD_PER_PAGE);
  const pagedFu = fu.slice((unsoldPage - 1) * UNSOLD_PER_PAGE, unsoldPage * UNSOLD_PER_PAGE);

  const usRaw = unsoldSummary;
  const us: any = typeof usRaw === 'string' ? (() => { try { return JSON.parse(usRaw); } catch { return null; } })()
    : usRaw?.total != null ? usRaw
    : usRaw?.data?.total != null ? usRaw.data : null;

  // 지역별 현황판 데이터 집계
  const unsoldRegionStats = regs.filter(r => r !== '전체').map(r => {
    const items = unsold.filter((u: Record<string, any>) => (u.region_nm || '기타') === r);
    const unitCount = items.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
    return { name: r, siteCount: items.length, unitCount };
  }).sort((a, b) => b.unitCount - a.unitCount);


    return (
     <div>

      {/* 미분양 현황 — 컴팩트 지역 비율 바 */}
      {unsoldRegionStats.length > 0 && (() => {
        const filteredTotal = fu.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
        const top5 = unsoldRegionStats.slice(0, 5);
        const top5Total = top5.reduce((s, r) => s + r.unitCount, 0);
        const restTotal = filteredTotal - top5Total;
        const barColors = ['var(--accent-red)', 'var(--accent-orange, #F97316)', 'var(--accent-yellow)', 'var(--accent-blue)', 'var(--accent-purple)'];
        return (
          <div style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>미분양 {filteredTotal.toLocaleString()}호</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fu.length}곳{freshDate ? ` · ${freshDate}` : ''}</span>
            </div>
            {/* 비율 바 */}
            <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
              {top5.map((r, i) => (
                <div key={r.name} style={{ flex: r.unitCount, background: barColors[i], transition: 'flex 0.3s' }} />
              ))}
              {restTotal > 0 && <div style={{ flex: restTotal, background: 'var(--bg-hover)' }} />}
            </div>
            {/* 범례 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {top5.map((r, i) => (
                <button key={r.name} onClick={() => { setUnsoldRegion(unsoldRegion === r.name ? '전체' : r.name); setUnsoldPage(1); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: unsoldRegion === r.name ? barColors[i] : 'var(--text-tertiary)', fontWeight: unsoldRegion === r.name ? 700 : 400, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 1, background: barColors[i], flexShrink: 0 }} />
                  {r.name} {r.unitCount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 미분양 추이 차트 */}
      {unsoldMonthly.length > 0 && (
        <div className="kd-card">
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>📈 전국 미분양 추이 (12개월)</div>
          <MiniLineChart
            data={(() => {
              const months = [...new Set(unsoldMonthly.map((s) => s.stat_month))].slice(-12);
              return months.map(m => {
                const rows = unsoldMonthly.filter((s) => s.stat_month === m);
                const total = rows.reduce((sum: number, r) => sum + (r.total_unsold || 0), 0);
                return { label: String(m).slice(5), value: total };
              });
            })()}
            color="var(--accent-blue)"
            secondaryData={(() => {
              const months = [...new Set(unsoldMonthly.map((s) => s.stat_month))].slice(-12);
              return months.map(m => {
                const rows = unsoldMonthly.filter((s) => s.stat_month === m);
                const total = rows.reduce((sum: number, r) => sum + (r.after_completion || 0), 0);
                return { label: String(m).slice(5), value: total };
              });
            })()}
            secondaryColor="var(--accent-red)"
            height={140}
            title=""
          />
          <div style={{ display: 'flex', gap: 'var(--sp-lg)', marginTop: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--accent-blue)', marginRight: 4, verticalAlign: 'middle' }} />전체 미분양</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--accent-red)', marginRight: 4, verticalAlign: 'middle', borderTop: '1px dashed var(--accent-red)' }} />준공후 미분양</span>
          </div>
        </div>
      )}

      {/* 안내 + 검색 + 필터 */}
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>국토교통부 미분양주택현황 월간 통계 (2~3개월 지연) · 최근 12개월 데이터</div>
      <div className="apt-pill-scroll kd-scroll-row" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 'var(--sp-sm)', paddingBottom: 2 }}>
        {regs.map(r => pill(r, unsoldRegion, setUnsoldRegion))}
        <div style={{ flexShrink: 0, width: 16 }} aria-hidden />
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>
        총 <strong style={{ color: 'var(--accent-red)' }}>{fu.length}</strong>건 · {fu.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0).toLocaleString()}세대
      </div>

      {/* 리스트 */}
      {pagedFu.map((u, i: number) => {
        const rate = u.tot_supply_hshld_co ? Math.round(((u.tot_unsold_hshld_co ?? 0) / u.tot_supply_hshld_co) * 100) : null;
        const pMin = u.sale_price_min ? Math.round(u.sale_price_min / 10000 * 10) / 10 : null;
        const pMax = u.sale_price_max ? Math.round(u.sale_price_max / 10000 * 10) / 10 : null;
        const priceStr = pMin ? `${pMin}억${pMax && pMax !== pMin ? `~${pMax}억` : ''}` : null;
        const ppAvg = (u as any).price_per_pyeong;
        const fmtP = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
        const completionLabel = (u as any).completion_ym ? `${String((u as any).completion_ym).slice(0, 4)}.${parseInt(String((u as any).completion_ym).slice(4, 6)) || '?'}` : null;
        const constructorShort = (u as any).constructor_nm ? String((u as any).constructor_nm).split('(')[0].trim().slice(0, 8) : ((u as any).developer_nm ? String((u as any).developer_nm).split('(')[0].trim().slice(0, 8) : null);

        const unsoldCount = u.tot_unsold_hshld_co || 0;
        const dangerColor = unsoldCount >= 1000 ? 'var(--accent-red)' : unsoldCount >= 500 ? 'var(--accent-orange)' : unsoldCount >= 100 ? 'var(--accent-yellow)' : 'var(--accent-green)';
        const kS = { textAlign: 'center' as const, padding: '5px 4px', background: 'var(--bg-surface)', borderRadius: 2 };
        const kL = { fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2, fontWeight: 500 as const };
        const kV = (c: string) => ({ fontSize: 'var(--fs-sm)', fontWeight: 800 as const, color: c, lineHeight: 1.3, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const });

        return (
          <Link key={u.id} href={`/apt/${encodeURIComponent(generateAptSlug(u.house_nm) || String(u.id))}`} className="hero-card" style={{ display: 'block', borderLeft: '3px solid rgba(248,113,113,0.5)' }}>
            {/* 히어로 이미지 */}
            <div className="hero-img">
              <img src={aptImageMap?.[u.house_nm] || `/api/og?title=${encodeURIComponent(u.house_nm || '미분양')}&category=apt&design=${(i % 6) + 1}`} alt={u.house_nm || "부동산 이미지"} width={400} height={120} loading="lazy" />
              <div className="hero-badges">
                <span className="hero-badge" style={{ background: 'rgba(220,38,38,0.9)', color: '#fff' }}>미분양</span>
                {isNew(u, 'unsold') && <span className="hero-badge" style={{ background: 'rgba(254,243,199,0.95)', color: '#92400E' }}>NEW</span>}
                {(u as any).discount_info && <span className="hero-badge" style={{ background: 'rgba(52,211,153,0.9)', color: '#fff' }}>🏷️ 할인</span>}
                {(() => { const sa = surgeAlerts.find(a => a.region_nm === u.region_nm); return sa && sa.change_pct !== 0 ? <span className="hero-badge" style={{ background: sa.change_pct > 0 ? 'rgba(248,113,113,0.9)' : 'rgba(52,211,153,0.9)', color: '#fff' }}>{sa.change_pct > 0 ? '+' : ''}{sa.change_pct}%</span> : null; })()}
                {constructorShort && <span className="hero-badge" style={{ background: 'rgba(255,255,255,0.92)', color: '#2563EB' }}>{constructorShort}</span>}
              </div>
              <div className="hero-chip">
                <div className="hero-overlay-stat">
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#F87171', lineHeight: 1 }}>{unsoldCount.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>잔여세대</div>
                </div>
              </div>
              <div className="hero-overlay">
                <div className="hero-name">{u.house_nm || '미분양'}</div>
                <div className="hero-addr">{u.region_nm}{u.sigungu_nm ? ` ${u.sigungu_nm}` : ''}{constructorShort ? ` · ${constructorShort}` : ''}{u.tot_supply_hshld_co ? ` · ${u.tot_supply_hshld_co.toLocaleString()}세대` : ''}</div>
              </div>
            </div>

            {/* 배지 행: 할인정보 + 역세권 */}
            {((u as any).discount_info || (u as any).nearest_station) && (
              <div style={{ padding: '6px 12px 2px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(u as any).discount_info && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 6, background: 'rgba(52,211,153,0.08)', color: 'var(--accent-green)', border: '1px solid rgba(52,211,153,0.15)' }}>🏷️ {String((u as any).discount_info).slice(0, 20)}</span>}
                {(u as any).nearest_station && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 6, background: 'rgba(96,165,250,0.08)', color: 'var(--accent-blue)', border: '1px solid rgba(96,165,250,0.15)' }}>🚇 {(u as any).nearest_station}</span>}
              </div>
            )}

            {/* ② 4x2 KPI 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, margin: '4px 10px 8px', background: 'var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={kS}><div style={kL}>미분양</div><div style={kV('var(--accent-red)')}>{unsoldCount.toLocaleString()}호</div></div>
              <div style={kS}><div style={kL}>전월대비</div><div style={kV((() => { const sa = surgeAlerts.find(a => a.region_nm === u.region_nm); return sa && sa.change_pct > 0 ? 'var(--accent-red)' : sa && sa.change_pct < 0 ? 'var(--accent-green)' : 'var(--text-tertiary)'; })())}>{(() => { const sa = surgeAlerts.find(a => a.region_nm === u.region_nm); return sa ? `${sa.change_pct > 0 ? '+' : ''}${sa.change_pct}%` : '집계중'; })()}</div></div>
              <div style={kS}><div style={kL}>분양가</div><div style={kV(priceStr ? 'var(--brand)' : 'var(--text-tertiary)')}>{priceStr || '문의'}</div></div>
              <div style={kS}><div style={kL}>평당가</div><div style={kV(ppAvg ? 'var(--accent-purple)' : 'var(--text-tertiary)')}>{ppAvg ? fmtP(ppAvg) : (priceStr ? '계산중' : '문의')}</div></div>
              <div style={kS}><div style={kL}>총공급</div><div style={kV('var(--text-primary)')}>{u.tot_supply_hshld_co ? u.tot_supply_hshld_co.toLocaleString() : '비공개'}</div></div>
              <div style={kS}><div style={kL}>준공</div><div style={kV(completionLabel ? 'var(--accent-green)' : 'var(--text-tertiary)')}>{completionLabel || '미정'}</div></div>
              <div style={kS}><div style={kL}>시공사</div><div style={kV('var(--text-primary)')}>{constructorShort || '미공개'}</div></div>
              <div style={kS}><div style={kL}>미분양률</div><div style={kV(dangerColor)}>{rate !== null ? `${rate}%` : '-'}</div></div>
            </div>

            {/* ③ 미분양률 바 */}
            {rate !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', marginBottom: 6 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? 'var(--accent-red)' : rate > 40 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: dangerColor, flexShrink: 0 }}>미분양 {rate}%</span>
              </div>
            )}

            {/* ④ AI 요약 */}
            {(u as any).ai_summary && (
              <div style={{ padding: '4px 12px 8px' }}><div style={{ padding: '4px 7px', borderLeft: '2px solid rgba(59,123,246,0.25)', fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{(u as any).ai_summary}</div></div>
            )}

            {/* ⑤ Engage + 액션 */}
            <div style={{ padding: '6px 12px 10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCommentTarget({ houseKey: `unsold_${u.id}`, houseNm: u.house_nm || '미분양', houseType: 'unsold' }); }} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>✏️ 한줄평</button>
              {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>홈페이지 →</a>}
              <a href={`/apt/${encodeURIComponent(generateAptSlug(u.house_nm) || String(u.id))}#interest-section`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 14, marginLeft: 'auto', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', lineHeight: 1, textDecoration: 'none', color: 'var(--text-tertiary)' }}>☆</a>
            </div>
          </Link>
        );
      })}

      {/* 페이지네이션 */}
      {unsoldTotalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-sm)', padding: 'var(--sp-md) 0' }}>
          <button onClick={() => setUnsoldPage(p => Math.max(1, p - 1))} disabled={unsoldPage === 1} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: unsoldPage === 1 ? 'var(--bg-hover)' : 'var(--brand)', color: unsoldPage === 1 ? 'var(--text-tertiary)' : '#fff', border: 'none', cursor: unsoldPage === 1 ? 'default' : 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>← 이전</button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{unsoldPage} / {unsoldTotalPages}</span>
          <button onClick={() => setUnsoldPage(p => Math.min(unsoldTotalPages, p + 1))} disabled={unsoldPage === unsoldTotalPages} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: unsoldPage === unsoldTotalPages ? 'var(--bg-hover)' : 'var(--brand)', color: unsoldPage === unsoldTotalPages ? 'var(--text-tertiary)' : '#fff', border: 'none', cursor: unsoldPage === unsoldTotalPages ? 'default' : 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>다음 →</button>
        </div>
      )}
      {fu.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{effectiveSearch ? `"${effectiveSearch}" 검색 결과가 없습니다` : '해당 지역 데이터가 없습니다'}{effectiveSearch && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>단지명, 지역으로 검색해보세요</div>}</div>}

      {/* LoginGate 기능 게이팅 (세션 108) */}
      <LoginGate feature="apt_unsold_alert" title="미분양 할인 알림" description="관심 지역 미분양 할인·재분양 시 알림" blurHeight={100}>
        <div style={{ padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: "var(--text-tertiary)" }}><span>알림 대상</span><span>변동 예정</span></div>
        </div>
      </LoginGate>
    </div>
  );

}
