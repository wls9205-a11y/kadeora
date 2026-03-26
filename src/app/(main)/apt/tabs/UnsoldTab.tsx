'use client';
import { useState, useEffect } from 'react';
import { type SharedTabProps, generateAptSlug } from './apt-utils';
import Link from 'next/link';
import MiniLineChart from '@/components/charts/MiniLineChart';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Props extends SharedTabProps {
  unsold: any[];
  unsoldMonthly: any[];
  unsoldSummary: any;
}

export default function UnsoldTab({ unsold, unsoldMonthly, unsoldSummary, aptUser, watchlist, toggleWatchlist, setCommentTarget, showToast, globalRegion }: Props) {
  const [unsoldRegion, setUnsoldRegion] = useState(globalRegion || '전체');
  const [unsoldSearch, setUnsoldSearch] = useState('');
  const [surgeAlerts, setSurgeAlerts] = useState<{ region_nm: string; current_count: number; change_pct: number }[]>([]);

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
      padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600,
      background: sel === v ? 'var(--brand)' : 'var(--bg-hover)',
      color: sel === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
      border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>
      {label || v}
    </button>
  );

  if (!unsold.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>🏚️ 미분양 데이터를 수집 중입니다<br/><span style={{ fontSize: 'var(--fs-sm)' }}>매월 국토교통부 통계 업데이트 시 반영됩니다</span></div>;
  const total = unsold.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
  const regs = ['전체', ...Array.from(new Set(unsold.map((u: any) => u.region_nm || '기타'))).sort()];
  const fu = (unsoldRegion === '전체' ? unsold : unsold.filter((u: any) => (u.region_nm || '기타') === unsoldRegion)).filter((u: any) => {
    if (!unsoldSearch) return true;
    const q = unsoldSearch.toLowerCase();
    return (u.house_nm || '').toLowerCase().includes(q) || (u.region_nm || '').toLowerCase().includes(q) || (u.sigungu_nm || '').toLowerCase().includes(q);
  });
  const usRaw = unsoldSummary;
  const us: any = typeof usRaw === 'string' ? (() => { try { return JSON.parse(usRaw); } catch { return null; } })()
    : usRaw?.total != null ? usRaw
    : usRaw?.data?.total != null ? usRaw.data : null;

  // 지역별 현황판 데이터 집계
  const unsoldRegionStats = regs.filter(r => r !== '전체').map(r => {
    const items = unsold.filter((u: any) => (u.region_nm || '기타') === r);
    const unitCount = items.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
    return { name: r, siteCount: items.length, unitCount };
  }).sort((a, b) => b.unitCount - a.unitCount);


    return (
    <div>
      {/* 지역 필터 — 컴팩트 필 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>미분양 현황</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-red)' }}>총 {total.toLocaleString()}세대</span>
      </div>
      <div className="apt-pill-scroll" style={{ display: 'flex', gap: 5, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        <button onClick={() => setUnsoldRegion('전체')} style={{
          padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: unsoldRegion === '전체' ? 700 : 500,
          background: unsoldRegion === '전체' ? 'var(--accent-red)' : 'var(--bg-hover)',
          color: unsoldRegion === '전체' ? '#fff' : 'var(--text-secondary)',
          border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          전체 {unsold.length}곳
        </button>
        {unsoldRegionStats.filter(r => r.unitCount > 0).map(r => (
          <button key={r.name} onClick={() => setUnsoldRegion(r.name === unsoldRegion ? '전체' : r.name)} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: unsoldRegion === r.name ? 700 : 500,
            background: unsoldRegion === r.name ? 'var(--accent-red)' : 'var(--bg-hover)',
            color: unsoldRegion === r.name ? '#fff' : 'var(--text-secondary)',
            border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {r.name} {r.unitCount.toLocaleString()}
          </button>
        ))}
        <div style={{ flexShrink: 0, width: 16 }} aria-hidden />
      </div>

      {/* 미분양 급증 경고 배너 — 지역별 현황 아래 */}
      {surgeAlerts.length > 0 && (
        <div style={{
          marginBottom: 14, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-red)' }}>미분양 급증 감지</span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전월 대비 20%+ 증가</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {surgeAlerts.map(a => (
              <button key={a.region_nm} onClick={() => setUnsoldRegion(a.region_nm)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 600,
                background: unsoldRegion === a.region_nm ? 'var(--accent-red)' : 'rgba(239,68,68,0.12)',
                color: unsoldRegion === a.region_nm ? 'var(--text-inverse)' : 'var(--accent-red)',
                border: 'none', cursor: 'pointer',
              }}>
                {a.region_nm} <span style={{ fontWeight: 800 }}>+{a.change_pct}%</span> ({a.current_count.toLocaleString()}세대)
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
        const filteredCapital = fu.filter((u: any) => capitalR.some(c => (u.region_nm || '').includes(c))).reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
        const filteredLocal = filteredTotal - filteredCapital;
        return (
        <div className="kd-card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>📊 {unsoldRegion !== '전체' ? `${unsoldRegion} ` : ''}미분양 현황</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{fu.length}곳</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평균 미분양</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{fu.length > 0 ? Math.round(filteredTotal / fu.length).toLocaleString() : 0}호</div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>국토교통부 통계누리 기준</div>
        </div>
        );
      })()}

      {/* 미분양 지역별 TOP5 */}
      {unsoldRegionStats.length > 0 && (
        <div className="kd-card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>🏚️ 미분양 많은 지역 TOP5</div>
          {unsoldRegionStats.slice(0, 5).map((r, i) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
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
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📈 전국 미분양 추이 (12개월)</div>
          <MiniLineChart
            data={(() => {
              const months = [...new Set(unsoldMonthly.map((s: any) => s.stat_month))].slice(-12);
              return months.map(m => {
                const rows = unsoldMonthly.filter((s: any) => s.stat_month === m);
                const total = rows.reduce((sum: number, r: any) => sum + (r.total_unsold || 0), 0);
                return { label: String(m).slice(5), value: total };
              });
            })()}
            color="var(--accent-blue)"
            secondaryData={(() => {
              const months = [...new Set(unsoldMonthly.map((s: any) => s.stat_month))].slice(-12);
              return months.map(m => {
                const rows = unsoldMonthly.filter((s: any) => s.stat_month === m);
                const total = rows.reduce((sum: number, r: any) => sum + (r.after_completion || 0), 0);
                return { label: String(m).slice(5), value: total };
              });
            })()}
            secondaryColor="var(--accent-red)"
            height={140}
            title=""
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--accent-blue)', marginRight: 4, verticalAlign: 'middle' }} />전체 미분양</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--accent-red)', marginRight: 4, verticalAlign: 'middle', borderTop: '1px dashed var(--accent-red)' }} />준공후 미분양</span>
          </div>
        </div>
      )}

      {/* 안내 + 검색 + 필터 */}
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 8 }}>국토교통부 미분양주택현황 월간 통계 (2~3개월 지연) · 최근 12개월 데이터</div>
      <input value={unsoldSearch} onChange={e => setUnsoldSearch(e.target.value)} placeholder="단지명, 지역 검색..." className="kd-search-input" />
      <div className="apt-pill-scroll" style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 8, paddingBottom: 2 }}>
        {regs.map(r => pill(r, unsoldRegion, setUnsoldRegion))}
        <div style={{ flexShrink: 0, width: 16 }} aria-hidden />
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 8 }}>
        총 <strong style={{ color: 'var(--accent-red)' }}>{fu.length}</strong>건 · {fu.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0).toLocaleString()}세대
      </div>

      {/* 리스트 */}
      {fu.map((u: any, i: number) => {
        const rate = u.tot_supply_hshld_co ? Math.round((u.tot_unsold_hshld_co / u.tot_supply_hshld_co) * 100) : null;
        const pMin = u.sale_price_min ? Math.round(u.sale_price_min / 10000 * 10) / 10 : null;
        const pMax = u.sale_price_max ? Math.round(u.sale_price_max / 10000 * 10) / 10 : null;
        const priceStr = pMin ? `${pMin}억${pMax && pMax !== pMin ? `~${pMax}억` : ''}` : null;

        const unsoldCount = u.tot_unsold_hshld_co || 0;
        const dangerColor = unsoldCount >= 1000 ? 'var(--accent-red)' : unsoldCount >= 500 ? 'var(--accent-orange)' : unsoldCount >= 100 ? 'var(--accent-yellow)' : 'var(--accent-green)';

        return (
          <div key={u.id} className="kd-card-hover" style={{
            padding: '16px 16px', borderRadius: 12, marginBottom: 8,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderLeft: `4px solid ${dangerColor}`, cursor: 'pointer',
          }}
          >
            {/* 줄1: 현장명 + 미분양 배지 + 분양가 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <Link href={`/apt/${encodeURIComponent(generateAptSlug(u.house_nm) || String(u.id))}`} style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{u.house_nm && u.source !== 'molit_stat' ? u.house_nm : `${u.region_nm} ${u.sigungu_nm || ''} 미분양`}</Link>
              <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 12, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)', fontWeight: 700, flexShrink: 0 }}>
                {unsoldCount >= 1000 ? '🔴' : unsoldCount >= 500 ? '🟠' : unsoldCount >= 100 ? '🟡' : '🟢'} 미분양 {unsoldCount.toLocaleString()}세대
              </span>
              {u.after_completion_unsold > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 8, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', fontWeight: 600 }}>악성 {u.after_completion_unsold}호</span>}
              {priceStr && <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--brand)', marginLeft: 'auto', flexShrink: 0 }}>{priceStr}</span>}
              <button onClick={(e) => { e.stopPropagation(); toggleWatchlist('unsold', String(u.id)); }} style={{ fontSize: 'var(--fs-xl)', background: watchlist.has(`unsold:${u.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`unsold:${u.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', transition: 'transform 0.1s', lineHeight: 1 }}>
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
              <div style={{ position: 'relative', height: 5, background: 'var(--bg-hover)', borderRadius: 2, marginBottom: 10 }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? 'var(--accent-red)' : rate > 40 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }} />
                <span style={{ position: 'absolute', right: 0, top: -14, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-red)' }}>{rate}%</span>
              </div>
            )}

            {/* 줄3: pill 버튼 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setCommentTarget({ houseKey: `unsold_${u.id}`, houseNm: u.house_nm || '미분양', houseType: 'unsold' })}
                style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>✏️ 한줄평</button>
              <Link href={`/apt/${encodeURIComponent(generateAptSlug(u.house_nm) || String(u.id))}`} style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>자세히 →</Link>
              {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>홈페이지 →</a>}
            </div>
          </div>
        );
      })}

      {fu.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>해당 지역 데이터가 없습니다</div>}
    </div>
  );

}
