import LoginGate from '@/components/LoginGate';
'use client';
import SectionShareButton from '@/components/SectionShareButton';
import type { RedevProject } from '@/types/apt';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { STAGE_COLORS, STAGE_ORDER, type SharedTabProps } from './apt-utils';
import { generateAptSlug } from '@/lib/apt-slug';
import EngageRow from '@/components/EngageRow';

interface Props extends SharedTabProps {
  redevelopment: RedevProject[];
  freshDate?: string;
}

export default function RedevTab({ redevelopment, watchlist, toggleWatchlist, setCommentTarget, showToast: _showToast, globalRegion, globalSearch, freshDate, aptImageMap, aptEngageMap }: Props) {
  const [redevType, setRedevType] = useState('전체');
  const [redevRegion, setRedevRegion] = useState(globalRegion || '전체');
  const [redevPage, setRedevPage] = useState(1);
  const [redevStage, setRedevStage] = useState('전체');
  const [redevSearch, setRedevSearch] = useState('');
  const [showDosiJeongbi, setShowDosiJeongbi] = useState(false);
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
    if (!showDosiJeongbi && r.sub_type === '도시환경정비') return false;
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Link href="/apt/redev" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--brand)', opacity: 0.8 }}>지역별 현황 →</Link>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>총 {filteredRedev.length}건 / {totalHouseholds.toLocaleString()}세대</span>
              </div>
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
                      <div style={{ fontSize: 10, fontWeight: 600, color: sc.color, opacity: 0.6, marginBottom: 2 }}>{i + 1}/{STAGE_ORDER.length}</div>
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
            <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              {pill('전체', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재개발', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재건축', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {/* 도시환경정비 토글 */}
              {(() => {
                const dosiCount = redevelopment.filter((r) => r.sub_type === '도시환경정비').length;
                return dosiCount > 0 ? (
                  <button onClick={() => { setShowDosiJeongbi(!showDosiJeongbi); setRedevPage(1); }} style={{ fontSize: 10, color: showDosiJeongbi ? '#94A3B8' : 'var(--text-tertiary)', background: showDosiJeongbi ? 'rgba(148,163,184,0.15)' : 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', cursor: 'pointer' }}>
                    도시정비 {dosiCount}건 {showDosiJeongbi ? '포함중' : '숨김'}
                  </button>
                ) : null;
              })()}
              {/* 시공사 확정 */}
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

            {/* 카드 리스트 (30건씩 페이지네이션) */}
            <div className="listing-grid">
            {filteredRedev.slice((redevPage - 1) * 30, redevPage * 30).map((r, i) => {
              const sc = STAGE_COLORS[r.stage || '정비구역지정'] || STAGE_COLORS['정비구역지정'];
              const stageIdx = STAGE_ORDER.indexOf(r.stage || '');
              const progress = stageIdx >= 0 ? Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100) : 0;
              const redevSlug = generateAptSlug(r.district_name || r.address || r.notes || `redev-${r.id}`);
              const displayName = r.district_name && r.district_name !== '미상' && r.district_name !== '정보 준비중' ? r.district_name : r.address || r.notes || '정보 준비중';
              const isDosiJeongbi = r.sub_type === '도시환경정비';
              return (
                <Link key={r.id} href={`/apt/${encodeURIComponent(redevSlug)}`} className="hero-card" style={{ display: 'block', borderLeft: `3px solid ${sc.border}`, opacity: isDosiJeongbi ? 0.7 : 1 }}>
                  {/* 히어로 이미지 */}
                  <div className="hero-img">
                    <img src={aptImageMap?.[r.district_name || ''] || `/api/og?title=${encodeURIComponent(displayName)}&category=apt&design=${(i % 6) + 1}`} alt={displayName} width={400} height={120} loading="lazy" />
                    <div className="hero-badges">
                      <span className="hero-badge" style={{ background: r.project_type === '재건축' ? 'rgba(245,158,11,0.9)' : isDosiJeongbi ? 'rgba(107,114,128,0.7)' : 'rgba(234,88,12,0.9)', color: '#fff' }}>
                        {isDosiJeongbi ? '도시정비' : r.project_type || '재개발'}
                      </span>
                      <span className="hero-badge" style={{ background: 'rgba(255,255,255,0.92)', color: sc.color }}>{r.stage || '진행중'}</span>
                      {r.constructor && <span className="hero-badge" style={{ background: 'rgba(255,255,255,0.92)', color: '#059669' }}>{r.constructor}</span>}
                    </div>
                    <div className="hero-chip">
                      <div className="hero-overlay-stat">
                        <div style={{ fontSize: 16, fontWeight: 800, color: sc.color === 'var(--text-tertiary)' ? '#A78BFA' : sc.color, lineHeight: 1 }}>{progress}%</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>진행률</div>
                      </div>
                    </div>
                    <div className="hero-overlay">
                      <div className="hero-name">{displayName}</div>
                      <div className="hero-addr">{r.region}{r.sigungu ? ` ${r.sigungu}` : ''}{r.total_households ? ` · ${r.total_households.toLocaleString()}세대 예정` : ''}</div>
                    </div>
                  </div>

                  {/* 진행바 인라인 */}
                  <div style={{ padding: '8px 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: sc.color, borderRadius: 3, transition: 'width .5s' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, flexShrink: 0 }}>{r.stage || '진행중'}</span>
                    <a href={`/apt/${encodeURIComponent(redevSlug)}#interest-section`} onClick={(e) => e.stopPropagation()} aria-label="관심등록" style={{ fontSize: 14, background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', lineHeight: 1, textDecoration: 'none', color: 'var(--text-tertiary)', flexShrink: 0 }}>☆</a>
                  </div>

                  {/* 핵심 KPI 인라인 */}
                  <div style={{ padding: '6px 12px', display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {r.total_households && <span>🏢 <strong style={{ color: 'var(--brand)' }}>{r.total_households.toLocaleString()}</strong>세대{r.existing_households ? <span style={{ color: 'var(--text-tertiary)' }}>(기존 {r.existing_households.toLocaleString()})</span> : ''}</span>}
                    {r.area_sqm && <span>📐 {r.area_sqm >= 10000 ? `${(r.area_sqm / 10000).toFixed(1)}만m²` : `${(r.area_sqm / 1000).toFixed(0)}천m²`}</span>}
                  </div>

                  {/* 건축지표 */}
                  {(r.floor_area_ratio || r.building_coverage || r.max_floor) && (
                    <div style={{ padding: '0 12px 6px', display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {r.floor_area_ratio && <span>📊 용적률 {Number(r.floor_area_ratio).toFixed(0)}%</span>}
                      {r.building_coverage && <span>🏠 건폐율 {Number(r.building_coverage).toFixed(0)}%</span>}
                      {r.max_floor && <span>🔝 {r.max_floor}층</span>}
                    </div>
                  )}

                  {/* 입지정보: 역세권 + 학군 + 입주예정 + 단계변경 */}
                  {(r.nearest_station || r.nearest_school || r.estimated_move_in || r.expected_completion || r.last_stage_change) && (
                    <div style={{ padding: '0 12px 6px', display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {r.nearest_station && <span style={{ color: 'var(--accent-blue)' }}>🚇 {r.nearest_station}</span>}
                      {r.nearest_school && <span style={{ color: 'var(--accent-cyan, #22D3EE)' }}>🏫 {r.nearest_school}</span>}
                      {(r.estimated_move_in || r.expected_completion) && <span style={{ color: 'var(--accent-green)' }}>📅 {r.estimated_move_in || r.expected_completion} 입주</span>}
                      {r.last_stage_change && <span style={{ color: 'var(--text-tertiary)' }}>🔄 {String(r.last_stage_change).slice(0, 10)}</span>}
                    </div>
                  )}

                  {/* 핵심 특징 */}
                  {r.key_features && (
                    <div style={{ padding: '0 12px 6px' }}><span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 6px', background: 'rgba(139,92,246,0.06)', borderRadius: 4, border: '1px solid rgba(139,92,246,0.1)' }}>✨ {String(r.key_features).slice(0, 40)}</span></div>
                  )}

                  {/* 실거래 + 블로그 */}
                  {(r.avg_trade_price || r.blog_count) ? (
                    <div style={{ padding: '0 12px 6px', display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {r.avg_trade_price ? <span>💰 구역 내 평균 <strong style={{ color: '#F59E0B' }}>{(r.avg_trade_price / 10000).toFixed(1)}억</strong>{r.recent_trade_count ? ` (${r.recent_trade_count}건)` : ''}</span> : null}
                      {r.blog_count ? <span>📝 분석 {r.blog_count}편</span> : null}
                    </div>
                  ) : null}

                  {/* AI 요약 */}
                  {r.ai_summary && (
                    <div style={{ padding: '0 12px 8px' }}><div style={{ padding: '3px 7px', borderLeft: `2px solid ${sc.border}`, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🤖 {r.ai_summary}</div></div>
                  )}
                  <EngageRow views={aptEngageMap?.[r.district_name || '']?.views} comments={aptEngageMap?.[r.district_name || '']?.comments} interest={aptEngageMap?.[r.district_name || '']?.interest} />
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

      {/* LoginGate 기능 게이팅 (세션 108) */}
      <LoginGate feature="redev_stage" title="사업 단계 변경 알림" description="관심 구역 단계가 바뀌면 즉시 알려드려요" blurHeight={100}>
        <div style={{ padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: "var(--text-tertiary)" }}><span>알림 대상</span><span>변동 예정</span></div>
        </div>
      </LoginGate>
    </>
  );
}
