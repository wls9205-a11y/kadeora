'use client';
import { useState, useEffect } from 'react';
import { STAGE_COLORS, STAGE_ORDER, type SharedTabProps } from './apt-utils';
import RedevTimeline from '@/components/RedevTimeline';
import BottomSheet from '@/components/BottomSheet';

interface Props extends SharedTabProps {
  redevelopment: any[];
}

export default function RedevTab({ redevelopment, watchlist, toggleWatchlist, setCommentTarget, showToast, globalRegion }: Props) {
  const [redevType, setRedevType] = useState('전체');
  const [redevRegion, setRedevRegion] = useState(globalRegion || '전체');
  const [redevPage, setRedevPage] = useState(1);
  const [redevStage, setRedevStage] = useState('전체');
  const [redevSearch, setRedevSearch] = useState('');
  const [selectedRedev, setSelectedRedev] = useState<any | null>(null);

  useEffect(() => {
    setRedevRegion(globalRegion || '전체');
    setRedevPage(1);
  }, [globalRegion]);

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

  if (!redevelopment.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>🏗️ 재개발·재건축 데이터를 수집 중입니다<br/><span style={{ fontSize: 'var(--fs-sm)' }}>각 지자체 정비사업 데이터 연동 시 표시됩니다</span></div>;

  // 지역별 현황판 데이터
  const redevRegionMap = new Map<string, { total: number; redev: number; rebuild: number; households: number }>();
  redevelopment.forEach((r: any) => {
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

  const redevRegs = ['전체', ...Array.from(new Set(redevelopment.map((r: any) => r.region || '기타'))).sort()];
  const filteredRedev = redevelopment.filter((r: any) => {
    if (redevType !== '전체' && r.project_type !== redevType) return false;
    if (redevRegion !== '전체' && r.region !== redevRegion) return false;
    if (redevStage !== '전체' && r.stage !== redevStage) return false;
    if (redevSearch) {
      const q = redevSearch.toLowerCase();
      if (!(r.district_name || '').toLowerCase().includes(q) && !(r.region || '').toLowerCase().includes(q) && !(r.sigungu || '').toLowerCase().includes(q) && !(r.constructor || '').toLowerCase().includes(q) && !(r.address || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a: any, b: any) => {
    const aOk = a.district_name && a.district_name !== '정보 준비중' && a.district_name !== '미상';
    const bOk = b.district_name && b.district_name !== '정보 준비중' && b.district_name !== '미상';
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    return 0;
  });

  const redevCount = filteredRedev.filter((r: any) => r.project_type === '재개발').length;
  const rebuildCount = filteredRedev.filter((r: any) => r.project_type === '재건축').length;
  const stageCount: Record<string, number> = {};
  STAGE_ORDER.forEach(s => { stageCount[s] = 0; });
  filteredRedev.forEach((r: any) => {
    const s = r.stage || '정비구역지정';
    if (stageCount[s] !== undefined) stageCount[s]++;
    else stageCount['정비구역지정']++; // 알 수 없는 stage는 정비구역지정으로
  });

  const totalHouseholds = filteredRedev.reduce((s: number, r: any) => s + (r.total_households || 0), 0);


  return (
    <>
          <div>
            {/* 지역 필터 — 컴팩트 필 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>재개발 현황</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>총 {redevelopment.length}건</span>
            </div>
            <div className="apt-pill-row">
              <button onClick={() => { setRedevRegion('전체'); setRedevPage(1); }} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: redevRegion === '전체' ? 700 : 500,
                background: redevRegion === '전체' ? 'var(--brand)' : 'var(--bg-hover)',
                color: redevRegion === '전체' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                전체 {redevelopment.length}
              </button>
              {redevRegionStats.filter(r => r.total > 0).map(r => (
                <button key={r.name} onClick={() => { setRedevRegion(r.name === redevRegion ? '전체' : r.name); setRedevPage(1); }} style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: redevRegion === r.name ? 700 : 500,
                  background: redevRegion === r.name ? 'var(--brand)' : 'var(--bg-hover)',
                  color: redevRegion === r.name ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {r.name} {r.total}
                </button>
              ))}
            </div>

            {/* 현황 요약 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{redevelopment.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전체</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-blue)' }}>{redevCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>재개발</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-orange)' }}>{rebuildCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>재건축</div>
              </div>
            </div>

            {/* 재개발 단계별 파이프라인 */}
            <div className="kd-card">
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🏗️ 단계별 파이프라인</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                {STAGE_ORDER.map((stage, i) => {
                  const regionFiltered = redevRegion === '전체' ? redevelopment : redevelopment.filter((r: any) => r.region === redevRegion);
                  const count = regionFiltered.filter((r: any) => r.stage === stage).length;
                  const total = regionFiltered.length || 1;
                  const pct = Math.round((count / total) * 100);
                  const sc = STAGE_COLORS[stage] || { bg: 'var(--bg-hover)', color: 'var(--text-tertiary)', border: 'var(--border)' };
                  return (
                    <div key={stage} onClick={() => { setRedevStage(stage === redevStage ? '전체' : stage); setRedevPage(1); }} style={{ flex: Math.max(pct, 8), textAlign: 'center', padding: '10px 4px', borderRadius: 8, background: redevStage === stage ? sc.border : sc.bg, border: `1px solid ${sc.border}`, position: 'relative', minWidth: 50, cursor: 'pointer', opacity: redevStage !== '전체' && redevStage !== stage ? 0.5 : 1 }}>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: sc.color }}>{stage.replace('인가', '')}</div>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: sc.color, margin: '4px 0' }}>{count}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: sc.color, opacity: 0.7 }}>{pct}%</div>
                      {i < STAGE_ORDER.length - 1 && <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>→</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 유형 필터 + 검색 */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {pill('전체', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재개발', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재건축', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {/* 시공사 있는 것만 필터 */}
              {(() => {
                const withConstructor = filteredRedev.filter((r: any) => r.constructor);
                return withConstructor.length > 0 ? (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-green)', fontWeight: 600, marginLeft: 'auto' }}>시공사 확정 {withConstructor.length}건</span>
                ) : null;
              })()}
            </div>
            <input value={redevSearch} onChange={e => { setRedevSearch(e.target.value); setRedevPage(1); }} placeholder="구역명, 지역, 시공사 검색..." className="kd-search-input" />

            {/* 안내 */}
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 8 }}>서울시 정비사업 정보몽땅 · 경기도 공공데이터 · 부산시 정비사업현황 API 기준 · 매주 월요일 자동 갱신</div>

            {/* 결과 카운트 */}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              총 <strong style={{ color: 'var(--text-primary)' }}>{filteredRedev.length}</strong>건
            </div>

            {/* 카드 리스트 (20건씩 페이지네이션) */}
            {filteredRedev.slice(0, redevPage * 20).map((r: any) => {
              const sc = STAGE_COLORS[r.stage] || STAGE_COLORS['정비구역지정'];
              const stageIdx = STAGE_ORDER.indexOf(r.stage);
              const progress = stageIdx >= 0 ? Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100) : 0;
              return (
                <div key={r.id} onClick={() => setSelectedRedev(r)} className="kd-card-hover" style={{
                  padding: '14px 16px 12px', borderRadius: 14, marginBottom: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  cursor: 'pointer',
                  position: 'relative', overflow: 'hidden',
                }}
                >
                  {/* 상단 진행률 바 (전체 너비) */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${sc.border}, var(--brand))` }} />
                  </div>
                  {/* 1행: 단계 + 유형 + 진행률 + 지역 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: sc.bg, color: sc.color }}>{r.stage}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: r.project_type === '재개발' ? 'rgba(96,165,250,0.1)' : 'rgba(251,146,60,0.1)', color: r.project_type === '재개발' ? 'var(--accent-blue-light)' : 'var(--accent-orange-light)' }}>{r.project_type}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: sc.color }}>{progress}%</span>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{r.region}</span>
                    <button onClick={(e) => { e.stopPropagation(); toggleWatchlist('redev', String(r.id)); }} style={{ fontSize: 'var(--fs-lg)', background: watchlist.has(`redev:${r.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`redev:${r.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', lineHeight: 1 }}>
                      {watchlist.has(`redev:${r.id}`) ? '⭐' : '☆'}
                    </button>
                  </div>
                  {/* 구역명 */}
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: (!r.district_name || r.district_name === '미상' || r.district_name === '정보 준비중') ? 'var(--text-tertiary)' : 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>
                    {r.district_name && r.district_name !== '미상' && r.district_name !== '정보 준비중' ? r.district_name : r.address || r.notes || '📋 정보 준비중'}
                  </div>
                  {/* 시군구 + 세대수 + 시공사 */}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    {r.sigungu}{r.total_households ? ` · ${r.total_households.toLocaleString()}세대` : (() => {
                      const stageMsg: Record<string, string> = {
                        '정비구역지정': ' · 세대수 미확정 (구역지정 단계)',
                        '조합설립': ' · 세대수 확정 전 (조합설립 단계)',
                        '사업시행인가': ' · 세대수 인가 후 확정 예정',
                        '관리처분': ' · 관리처분계획 참조',
                        '착공': ' · 사업시행계획 참조',
                      };
                      return stageMsg[r.stage] || ' · 세대수 미확정';
                    })()}{r.constructor ? ` · ${r.constructor}` : ''}
                  </div>
                  {/* 비고/예상준공 */}
                  {(r.notes || r.expected_completion) && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                      {r.notes}{r.expected_completion ? (r.notes ? `, ${r.expected_completion}` : r.expected_completion) : ''}
                    </div>
                  )}
                </div>
              );
            })}

            {redevPage * 20 < filteredRedev.length && (
              <button onClick={() => setRedevPage(p => p + 1)} style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', marginBottom: 8,
              }}>
                더 보기 ({Math.min(redevPage * 20, filteredRedev.length)} / {filteredRedev.length}건)
              </button>
            )}

            {filteredRedev.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>조건에 맞는 프로젝트가 없습니다</div>}
          </div>

      {/* 재개발 상세 모달 */}
      {selectedRedev && (() => {
        const r = selectedRedev;
        const sc = STAGE_COLORS[r.stage] || STAGE_COLORS['정비구역지정'];
        return (
    <BottomSheet open={!!selectedRedev} onClose={() => setSelectedRedev(null)} title={r.district_name && r.district_name !== '미상' ? r.district_name : r.address || r.notes || '정비사업'}>
        {/* 헤더 뱃지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{r.stage}</span>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: r.project_type === '재개발' ? 'rgba(96,165,250,0.1)' : 'rgba(251,146,60,0.1)', color: r.project_type === '재개발' ? 'var(--accent-blue-light)' : 'var(--accent-orange-light)' }}>{r.project_type}</span>
        </div>
        {r.address && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
            📍 {r.address}
          </div>
        )}
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: r.ai_summary ? 8 : 16 }}>
          {r.region}{r.sigungu ? ` ${r.sigungu}` : ''}{r.total_households ? ` · ${r.total_households.toLocaleString()}세대` : ` · 세대수 ${r.stage === '정비구역지정' || r.stage === '조합설립' ? '미확정' : '확인 필요'}`}
        </div>
        {r.ai_summary && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-blue-bg), rgba(52,211,153,0.06))', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 3 }}>🤖 AI 분석</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.ai_summary}</div>
          </div>
        )}

        {/* 진행 타임라인 */}
        <RedevTimeline currentStage={r.stage || '정비구역지정'} />

        {/* 사업 진행률 파이프라인 */}
        {(() => {
          const currentIdx = STAGE_ORDER.indexOf(r.stage);
          const progress = currentIdx >= 0 ? Math.round(((currentIdx + 1) / STAGE_ORDER.length) * 100) : 0;
          return (
            <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>📊 사업 진행률</span>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--brand)' }}>{progress}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-green), var(--brand))', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {STAGE_ORDER.map((stage, i) => {
                  const isCurrent = stage === r.stage;
                  const isPast = currentIdx >= 0 && i < currentIdx;
                  const stageColor = STAGE_COLORS[stage] || STAGE_COLORS['정비구역지정'];
                  return (
                    <div key={stage} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', margin: '0 auto 4px',
                        background: isCurrent ? stageColor.border : isPast ? 'var(--text-tertiary)' : 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: isCurrent ? '2px solid var(--brand)' : 'none',
                        boxShadow: isCurrent ? '0 0 8px rgba(37,99,235,0.4)' : 'none',
                      }}>
                        {(isPast || isCurrent) && <span style={{ color: 'var(--text-inverse)', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: isCurrent ? 'var(--brand)' : isPast ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: isCurrent ? 800 : 400, lineHeight: 1.2 }}>
                        {stage.replace('사업시행인가', '시행인가').replace('정비구역지정', '구역지정').replace('관리처분', '관리처분')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          {[
            r.address && ['📍 주소', r.address],
            r.constructor && ['🏗️ 시공사', r.constructor],
            r.developer && ['🏢 시행사', r.developer],
            r.total_dong && ['🏠 동수', `${r.total_dong}개 동`],
            r.max_floor && ['📏 최고층', `지상 ${r.max_floor}층`],
            r.total_households && ['👥 세대수', `${r.total_households.toLocaleString()}세대`],
            r.floor_area_ratio && ['📐 용적률', `${r.floor_area_ratio}%`],
            r.building_coverage && ['📐 건폐율', `${r.building_coverage}%`],
            r.land_area && ['🗺️ 부지면적', `${r.land_area.toLocaleString()}㎡`],
            r.nearest_station && ['🚆 최근접 역', r.nearest_station],
            r.nearest_school && ['🏫 초등학교', r.nearest_school],
            r.estimated_move_in && ['🗓️ 입주예정', r.estimated_move_in],
            r.expected_completion && ['🗓️ 예상 준공', r.expected_completion],
            r.transfer_limit && ['🔒 전매제한', r.transfer_limit],
            r.stage && ['📅 현재 단계', r.stage],
            r.notes && ['📝 비고', r.notes],
          ].filter(Boolean).map(([label, value]: any) => (
            <div key={label} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>
              <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, width: 70 }}>{label}</span>
              <span style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* 요약 / 핵심 특징 */}
        {(r.summary || r.key_features) ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>📋 사업 요약</div>
            {r.key_features && <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--brand)', marginBottom: 6 }}>💡 {r.key_features}</div>}
            {r.summary && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{r.summary}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0', marginBottom: 16 }}>
            요약 정보를 준비 중입니다
          </div>
        )}

        {/* 한줄평 */}
        <button onClick={() => { setSelectedRedev(null); setCommentTarget({ houseKey: `redev_${r.id}`, houseNm: r.district_name || '정비사업', houseType: 'redev' as any }); }} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', marginBottom: 12, fontWeight: 600 }}>
          💬 한줄평 작성하기
        </button>

        {/* 지도 버튼 */}
        {(r.address || (r.district_name && r.district_name !== '미상' && r.district_name !== '정보 준비중')) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <a href={`https://map.kakao.com/?q=${encodeURIComponent(r.address || r.district_name || '')}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 카카오맵</a>
            <a href={`https://map.naver.com/p/search/${encodeURIComponent(r.address || r.district_name || '')}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 네이버지도</a>
          </div>
        )}
    </BottomSheet>
  );

      })()}
    </>
  );
}
