'use client';
import SectionShareButton from '@/components/SectionShareButton';
import type { RedevProject } from '@/types/apt';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { STAGE_COLORS, STAGE_ORDER, type SharedTabProps } from './apt-utils';
import { generateAptSlug } from '@/lib/apt-slug';
import dynamic from 'next/dynamic';

const RedevTimeline = dynamic(() => import('@/components/RedevTimeline'), { ssr: false });

interface Props extends SharedTabProps {
  redevelopment: RedevProject[];
  freshDate?: string;
}

export default function RedevTab({ redevelopment, watchlist, toggleWatchlist, setCommentTarget, showToast: _showToast, globalRegion, globalSearch, freshDate }: Props) {
  const [redevType, setRedevType] = useState('전체');
  const [redevRegion, setRedevRegion] = useState(globalRegion || '전체');
  const [redevPage, setRedevPage] = useState(1);
  const [redevStage, setRedevStage] = useState('전체');
  const [redevSearch, setRedevSearch] = useState('');
  const effectiveSearch = globalSearch || redevSearch;
  // selectedRedev removed — now using Link to /apt/[slug]

  useEffect(() => {
    setRedevRegion(globalRegion || '전체');
    setRedevPage(1);
  }, [globalRegion]);

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

  if (!redevelopment.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>🏗️ 재개발·재건축 데이터를 수집 중입니다<br/><span style={{ fontSize: 'var(--fs-sm)' }}>각 지자체 정비사업 데이터 연동 시 표시됩니다</span></div>;

  // 지역별 현황판 데이터
  const redevRegionMap = new Map<string, { total: number; redev: number; rebuild: number; households: number }>();
  redevelopment.forEach((r) => {
    const region = r.region || '기타';
    const cur = redevRegionMap.get(region) || { total: 0, redev: 0, rebuild: 0, households: 0 };
    cur.total++;
    if (r.project_type === '재개발') cur.redev++; else cur.rebuild++;
    cur.households += r.total_households || 0;
    redevRegionMap.set(region, cur);
  });
  const redevRegionStats = Array.from(redevRegionMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total);

  const redevRegs = ['전체', ...Array.from(new Set(redevelopment.map((r) => r.region || '기타'))).sort()];
  const filteredRedev = redevelopment.filter((r) => {
    if (redevType !== '전체' && r.project_type !== redevType) return false;
    if (redevRegion !== '전체' && r.region !== redevRegion) return false;
    if (redevStage !== '전체' && r.stage !== redevStage) return false;
    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase();
      if (!(r.district_name || '').toLowerCase().includes(q) && !(r.region || '').toLowerCase().includes(q) && !(r.sigungu || '').toLowerCase().includes(q) && !(r.constructor || '').toLowerCase().includes(q) && !(r.address || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    const aOk = a.district_name && a.district_name !== '정보 준비중' && a.district_name !== '미상';
    const bOk = b.district_name && b.district_name !== '정보 준비중' && b.district_name !== '미상';
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    return 0;
  });

  const redevCount = filteredRedev.filter((r) => r.project_type === '재개발').length;
  const rebuildCount = filteredRedev.filter((r) => r.project_type === '재건축').length;
  const stageCount: Record<string, number> = {};
  STAGE_ORDER.forEach(s => { stageCount[s] = 0; });
  filteredRedev.forEach((r) => {
    const s = r.stage || '정비구역지정';
    if (stageCount[s] !== undefined) stageCount[s]++;
    else stageCount['정비구역지정']++; // 알 수 없는 stage는 정비구역지정으로
  });

  const totalHouseholds = filteredRedev.reduce((s: number, r) => s + (r.total_households || 0), 0);


  return (
    <>
          <div>
            {/* 재개발/재건축 현황 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>재개발·재건축 현황</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>총 {filteredRedev.length}건 / {totalHouseholds.toLocaleString()}세대</span>
            </div>


            {/* 현황 요약 */}
            <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)' }}>{redevelopment.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전체</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--accent-blue)' }}>{redevCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>재개발</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--accent-orange)' }}>{rebuildCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>재건축</div>
              </div>
            </div>

            {/* 재개발 단계별 파이프라인 */}
            <div className="kd-card">
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>🏗️ 단계별 파이프라인</div>
              <div style={{ display: 'flex', gap: 'var(--sp-xs)', alignItems: 'stretch' }}>
                {STAGE_ORDER.map((stage, i) => {
                  const regionFiltered = redevRegion === '전체' ? redevelopment : redevelopment.filter((r) => r.region === redevRegion);
                  const count = regionFiltered.filter((r) => r.stage === stage).length;
                  const total = regionFiltered.length || 1;
                  const pct = Math.round((count / total) * 100);
                  const sc = STAGE_COLORS[stage] || { bg: 'var(--bg-hover)', color: 'var(--text-tertiary)', border: 'var(--border)' };
                  return (
                    <div key={stage} onClick={() => { setRedevStage(stage === redevStage ? '전체' : stage); setRedevPage(1); }} style={{ flex: Math.max(pct, 8), textAlign: 'center', padding: '10px 4px', borderRadius: 'var(--radius-sm)', background: redevStage === stage ? sc.border : sc.bg, border: `1px solid ${sc.border}`, position: 'relative', minWidth: 50, cursor: 'pointer', opacity: redevStage !== '전체' && redevStage !== stage ? 0.5 : 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: sc.color, opacity: 0.6, marginBottom: 2 }}>{i + 1}/{STAGE_ORDER.length}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: sc.color }}>{stage.replace('인가', '')}</div>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: sc.color, margin: '4px 0' }}>{count}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: sc.color, opacity: 0.7 }}>{pct}%</div>
                      {i < STAGE_ORDER.length - 1 && <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>→</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 유형 필터 + 검색 */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 'var(--sp-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              {pill('전체', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재개발', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재건축', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {/* 시공사 있는 것만 필터 */}
              {(() => {
                const withConstructor = filteredRedev.filter((r) => r.constructor);
                return withConstructor.length > 0 ? (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-green)', fontWeight: 600, marginLeft: 'auto' }}>시공사 확정 {withConstructor.length}건</span>
                ) : null;
              })()}
            </div>

            {/* 안내 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>서울시 정비사업 정보몽땅 · 경기도 공공데이터 · 부산시 정비사업현황 API 기준{freshDate ? ` · ${freshDate} 갱신` : ''} · 매주 월요일 자동 갱신</div>
              <SectionShareButton section="apt-redev" label="재개발·재건축 현황 — 단계별 진행상황" pagePath="/apt?tab=redev" />
            </div>

            {/* 결과 카운트 */}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>
              총 <strong style={{ color: 'var(--text-primary)' }}>{filteredRedev.length}</strong>건
            </div>

            {/* 카드 리스트 (20건씩 페이지네이션) */}
            <div className="listing-grid">
            {filteredRedev.slice((redevPage - 1) * 30, redevPage * 30).map((r) => {
              const sc = STAGE_COLORS[r.stage || '정비구역지정'] || STAGE_COLORS['정비구역지정'];
              const stageIdx = STAGE_ORDER.indexOf(r.stage || '');
              const progress = stageIdx >= 0 ? Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100) : 0;
              const redevSlug = generateAptSlug(r.district_name || r.address || r.notes || `redev-${r.id}`);
              return (
                <Link key={r.id} href={`/apt/${encodeURIComponent(redevSlug)}`} className="kd-card-hover" style={{
                  display: 'block', textDecoration: 'none', color: 'inherit',
                  borderRadius: 'var(--radius-card)', overflow: 'hidden',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  cursor: 'pointer', position: 'relative',
                }}>
                  {/* 상단 진행률 바 */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--bg-hover)' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${sc.border}, var(--brand))` }} />
                  </div>
                  <div style={{ padding: '14px 12px 8px' }}>
                    {/* 배지 행 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: sc.bg, color: sc.color }}>{r.stage}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: r.project_type === '재개발' ? 'rgba(96,165,250,0.1)' : 'rgba(251,146,60,0.1)', color: r.project_type === '재개발' ? 'var(--accent-blue-light)' : 'var(--accent-orange-light)' }}>{r.project_type}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: sc.color }}>{progress}%</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{r.region}</span>
                      <button aria-label="즐겨찾기" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist('redev', String(r.id)); }} style={{ fontSize: 16, background: watchlist.has(`redev:${r.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`redev:${r.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 5px', cursor: 'pointer', lineHeight: 1 }}>
                        {watchlist.has(`redev:${r.id}`) ? '⭐' : '☆'}
                      </button>
                    </div>
                    {/* 구역명 */}
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: (!r.district_name || r.district_name === '미상' || r.district_name === '정보 준비중') ? 'var(--text-tertiary)' : 'var(--text-primary)', marginBottom: 2, lineHeight: 1.3 }}>
                      {r.district_name && r.district_name !== '미상' && r.district_name !== '정보 준비중' ? r.district_name : r.address || r.notes || '📋 정보 준비중'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>{r.address || ''}</div>

                    {/* 7열 KPI 그리드 (모바일 4+3) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, marginBottom: 1, background: 'var(--bg-hover)', borderRadius: '6px 6px 0 0', overflow: 'hidden' }}>
                      {[
                        { l: '총세대', v: r.total_households ? r.total_households.toLocaleString() : '확인중', c: r.total_households ? 'var(--brand)' : 'var(--text-tertiary)' },
                        { l: '시공사', v: r.constructor ? r.constructor.split('(')[0].split('주식')[0].trim().slice(0, 6) : '-', c: 'var(--text-primary)' },
                        { l: '시행사', v: (r as any).developer ? String((r as any).developer).split('(')[0].trim().slice(0, 6) : '-', c: 'var(--text-primary)' },
                        { l: '예상준공', v: r.expected_completion ? r.expected_completion.replace(/년|예정/g, '').trim().slice(0, 7) : '-', c: r.expected_completion ? 'var(--accent-green)' : 'var(--text-tertiary)' },
                      ].map((k, ki) => <div key={ki} style={{ textAlign: 'center', padding: '5px 2px', background: 'var(--bg-surface)' }}><div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 1 }}>{k.l}</div><div style={{ fontSize: 11, fontWeight: 800, color: k.c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.v}</div></div>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, marginBottom: 6, background: 'var(--bg-hover)', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                      {[
                        { l: '대지면적', v: r.land_area ? `${(r.land_area / 1000).toFixed(0)}천㎡` : '-', c: 'var(--text-primary)' },
                        { l: '용적률', v: r.floor_area_ratio ? `${r.floor_area_ratio}%` : '-', c: 'var(--accent-purple)' },
                        { l: '건폐율', v: r.building_coverage ? `${r.building_coverage}%` : '-', c: 'var(--text-primary)' },
                        { l: '최고층', v: r.max_floor ? `${r.max_floor}F` : '-', c: r.max_floor ? 'var(--accent-yellow)' : 'var(--text-tertiary)' },
                      ].map((k, ki) => <div key={ki} style={{ textAlign: 'center', padding: '5px 2px', background: 'var(--bg-surface)' }}><div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 1 }}>{k.l}</div><div style={{ fontSize: 11, fontWeight: 800, color: k.c }}>{k.v}</div></div>)}
                    </div>

                    {/* 6단계 진행 바 */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, borderRadius: 2, background: `linear-gradient(90deg, ${sc.border}, var(--brand))` }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        {['구역지정', '조합설립', '사업인가', '관리처분', '착공', '준공'].map((s, i) => {
                          const sp = [10, 25, 45, 65, 85, 100];
                          const isActive = progress >= sp[i];
                          return <span key={s} style={{ fontSize: 8, color: isActive ? sc.color : 'var(--text-tertiary)', fontWeight: isActive ? 700 : 400 }}>{s}</span>;
                        })}
                      </div>
                    </div>

                    {/* AI 요약 */}
                    {r.ai_summary && (
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '5px 7px', background: 'var(--bg-hover)', borderRadius: 5, borderLeft: `2px solid ${sc.border}`, marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{r.ai_summary}</div>
                    )}

                    {/* 위치/특징 배지 */}
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {r.sigungu && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(59,123,246,0.06)', color: 'var(--brand)', fontWeight: 600 }}>{r.sigungu}</span>}
                      {r.nearest_station && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(59,123,246,0.08)', color: 'var(--brand)', fontWeight: 700 }}>🚇 {r.nearest_station}</span>}
                      {r.nearest_school && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(52,211,153,0.06)', color: 'var(--accent-green)', fontWeight: 600 }}>🏫 {r.nearest_school}</span>}
                      {r.key_features && String(r.key_features).split(',').slice(0, 3).map((f: string) => <span key={f} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(167,139,250,0.06)', color: 'var(--accent-purple)' }}>{f.trim()}</span>)}
                      {r.address && !r.sigungu && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)' }}>{r.address.split(' ').slice(-2).join(' ').replace(/일원|일대|번지/g, '').trim()}</span>}
                      {r.notes && !r.expected_completion && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>{String(r.notes).slice(0, 20)}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
            </div>

            {Math.ceil(filteredRedev.length / 30) > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-sm)', padding: 'var(--sp-md) 0' }}>
                <button onClick={() => setRedevPage(p => Math.max(1, p - 1))} disabled={redevPage === 1} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: redevPage === 1 ? 'var(--bg-hover)' : 'var(--brand)', color: redevPage === 1 ? 'var(--text-tertiary)' : '#fff', border: 'none', cursor: redevPage === 1 ? 'default' : 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>← 이전</button>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{redevPage} / {Math.ceil(filteredRedev.length / 30)}</span>
                <button onClick={() => setRedevPage(p => Math.min(Math.ceil(filteredRedev.length / 30), p + 1))} disabled={redevPage >= Math.ceil(filteredRedev.length / 30)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: redevPage >= Math.ceil(filteredRedev.length / 30) ? 'var(--bg-hover)' : 'var(--brand)', color: redevPage >= Math.ceil(filteredRedev.length / 30) ? 'var(--text-tertiary)' : '#fff', border: 'none', cursor: redevPage >= Math.ceil(filteredRedev.length / 30) ? 'default' : 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>다음 →</button>
              </div>
            )}

            {filteredRedev.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>{effectiveSearch ? `"${effectiveSearch}" 검색 결과가 없습니다` : '조건에 맞는 프로젝트가 없습니다'}{effectiveSearch && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>구역명, 지역, 시공사로 검색해보세요</div>}</div>}
          </div>

      {/* 재개발 상세 모달 */}
    </>
  );
}
