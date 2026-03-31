'use client';
import SectionShareButton from '@/components/SectionShareButton';
import type { UnsoldApt } from '@/types/apt';
import { useState, useEffect } from 'react';
import { type SharedTabProps, generateAptSlug } from './apt-utils';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const MiniLineChart = dynamic(() => import('@/components/charts/MiniLineChart'), { ssr: false });

interface Props extends SharedTabProps {
  unsold: UnsoldApt[];
  unsoldMonthly: { stat_month: string; total_unsold: number; after_completion: number; region?: string }[];
  unsoldSummary: Record<string, any> | string | null;
  freshDate?: string;
}

export default function UnsoldTab({ unsold, unsoldMonthly, unsoldSummary, aptUser, watchlist, toggleWatchlist, setCommentTarget, showToast, globalRegion, globalSearch, freshDate }: Props) {
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

  // 필터 변경 시 1페이지 리셋
  useEffect(() => { setUnsoldPage(1); }, [unsoldRegion, effectiveSearch]);

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
      {/* 미분양 현황 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>미분양 현황</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-red)' }}>총 {total.toLocaleString()}세대</span>
      </div>

      {/* 미분양 급증 경고 배너 — 지역별 현황 아래 */}
      {surgeAlerts.length > 0 && (
        <div style={{
          marginBottom: 'var(--sp-md)', padding: '12px 16px', borderRadius: 'var(--radius-card)',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-red)' }}>미분양 급증 감지</span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전월 대비 20%+ 증가</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {surgeAlerts.map(a => (
              <button key={a.region_nm} onClick={() => setUnsoldRegion(a.region_nm)} style={{
                padding: '4px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                background: unsoldRegion === a.region_nm ? 'var(--accent-red)' : 'rgba(239,68,68,0.12)',
                color: unsoldRegion === a.region_nm ? 'var(--text-inverse)' : 'var(--accent-red)',
                border: 'none', cursor: 'pointer',
              }}>
                {a.region_nm} <span style={{ fontWeight: 800 }}>+{a.change_pct}%</span> <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.8 }}>{(a.prev_count || 0).toLocaleString()} <span style={{ color: a.change_pct > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>→</span> {a.current_count.toLocaleString()}세대</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 종합 현황판 */}
      {(() => {
        const filteredTotal = fu.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
        const filteredAfterCompletion = fu.reduce((s: number, u: any) => s + (u.after_completion_unsold || 0), 0);
        const capitalR = ['서울', '경기', '인천'];
        const filteredCapital = fu.filter((u: Record<string, any>) => capitalR.some(c => (u.region_nm || '').includes(c))).reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
        const filteredLocal = filteredTotal - filteredCapital;
        return (
        <div className="kd-card" style={{ marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>📊 {unsoldRegion !== '전체' ? `${unsoldRegion} ` : ''}미분양 현황</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{unsoldRegion !== '전체' ? unsoldRegion : '전국'}</div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--brand)' }}>{filteredTotal.toLocaleString()}호</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>준공후(악성)</div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-red)' }}>{filteredAfterCompletion.toLocaleString()}호</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>단지 수</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{fu.length}곳</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평균 미분양</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{fu.length > 0 ? Math.round(filteredTotal / fu.length).toLocaleString() : 0}호</div>
            </div>
          </div>
          {/* 준공후 미분양 비율 게이지 */}
          {filteredTotal > 0 && filteredAfterCompletion > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-xs)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>준공후 미분양(악성) 비율</span>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: Math.round(filteredAfterCompletion / filteredTotal * 100) > 30 ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>{Math.round(filteredAfterCompletion / filteredTotal * 100)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: Math.round(filteredAfterCompletion / filteredTotal * 100) > 30 ? 'var(--accent-red)' : 'var(--accent-yellow)', width: `${Math.round(filteredAfterCompletion / filteredTotal * 100)}%`, transition: 'width 0.6s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>일반 미분양 {(filteredTotal - filteredAfterCompletion).toLocaleString()}호</span>
                <span style={{ fontSize: 10, color: 'var(--accent-red)' }}>준공후 {filteredAfterCompletion.toLocaleString()}호</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-sm)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>국토교통부 통계누리 기준{freshDate ? ` · ${freshDate} 수집` : ''}</div>
            <SectionShareButton section="apt-unsold" label="미분양 아파트 현황 — 지역별 미분양 세대수" pagePath="/apt?tab=unsold" />
          </div>
        </div>
        );
      })()}

      {/* 미분양 지역별 TOP5 */}
      {unsoldRegionStats.length > 0 && (
        <div className="kd-card" style={{ marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>🏚️ 미분양 많은 지역 TOP5</div>
          {unsoldRegionStats.slice(0, 5).map((r, i) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', width: 20 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-red)' }}>{r.unitCount.toLocaleString()}호</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{r.siteCount}곳</span>
            </div>
          ))}
        </div>
      )}

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
      <div className="apt-pill-scroll kd-scroll-row" style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 'var(--sp-sm)', paddingBottom: 2 }}>
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

        const unsoldCount = u.tot_unsold_hshld_co || 0;
        const dangerColor = unsoldCount >= 1000 ? 'var(--accent-red)' : unsoldCount >= 500 ? 'var(--accent-orange)' : unsoldCount >= 100 ? 'var(--accent-yellow)' : 'var(--accent-green)';

        return (
          <div key={u.id} className="kd-card-hover" style={{
            padding: '16px 16px', borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-sm)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderLeft: `4px solid ${dangerColor}`, cursor: 'pointer',
          }}
          >
            {/* 줄1: 현장명 + 미분양 배지 + 분양가 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-xs)', flexWrap: 'wrap' }}>
              <Link href={`/apt/${encodeURIComponent(generateAptSlug(u.house_nm) || String(u.id))}`} style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'none' }}>{u.house_nm && u.source !== 'molit_stat' ? u.house_nm : `${u.region_nm} ${u.sigungu_nm || ''} 미분양`}</Link>
              <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 'var(--radius-card)', background: 'var(--accent-red-bg)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)', fontWeight: 700, flexShrink: 0 }}>
                {unsoldCount >= 1000 ? '🔴' : unsoldCount >= 500 ? '🟠' : unsoldCount >= 100 ? '🟡' : '🟢'} 미분양 {unsoldCount.toLocaleString()}세대
              </span>
              {(u.after_completion_unsold ?? 0) > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-red-bg)', color: 'var(--accent-red)', fontWeight: 600 }}>악성 {u.after_completion_unsold}호</span>}
              {priceStr && <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--brand)', marginLeft: 'auto', flexShrink: 0 }}>{priceStr}</span>}
              <button onClick={(e) => { e.stopPropagation(); toggleWatchlist('unsold', String(u.id)); }} style={{ fontSize: 'var(--fs-xl)', background: watchlist.has(`unsold:${u.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`unsold:${u.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', cursor: 'pointer', transition: 'transform 0.1s', lineHeight: 1 }}>
                {watchlist.has(`unsold:${u.id}`) ? '⭐' : '☆'}
              </button>
            </div>

            {/* 줄2: 지역 + 세대 */}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 6 }}>
              {u.region_nm}{u.sigungu_nm ? ` ${u.sigungu_nm}` : ''}
              {u.tot_supply_hshld_co && <span> · 총 {u.tot_supply_hshld_co.toLocaleString()}세대</span>}
              {u.completion_ym && <span> · 준공 {u.completion_ym.slice(0, 4)}.{u.completion_ym.slice(4, 6)}</span>}
            </div>

            {/* 미분양률 바 */}
            {rate !== null && (
              <div style={{ position: 'relative', height: 5, background: 'var(--bg-hover)', borderRadius: 2, marginBottom: 'var(--sp-sm)' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? 'var(--accent-red)' : rate > 40 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }} />
                <span style={{ position: 'absolute', right: 0, top: -14, fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent-red)' }}>{rate}%</span>
              </div>
            )}

            {/* 분양가 범위 바 (가격 정보 있으면) */}
            {pMin && pMax && pMin !== pMax && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
                <span style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 600 }}>{pMin}억</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, rgba(96,165,250,0.3), var(--brand), rgba(248,113,113,0.3))', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -1, left: '50%', width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', border: '1.5px solid var(--bg-surface)', transform: 'translateX(-50%)' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--accent-red)', fontWeight: 600 }}>{pMax}억</span>
              </div>
            )}

            {/* 줄3: pill 버튼 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setCommentTarget({ houseKey: `unsold_${u.id}`, houseNm: u.house_nm || '미분양', houseType: 'unsold' })}
                style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>✏️ 한줄평</button>
              <Link href={`/apt/${encodeURIComponent(generateAptSlug(u.house_nm) || String(u.id))}`} style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>자세히 →</Link>
              {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>홈페이지 →</a>}
            </div>
          </div>
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
    </div>
  );

}
