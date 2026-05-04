'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { KR_REGIONS_17, setStoredRegion } from '@/lib/region-storage';

interface SummaryRow {
  region: string;
  sigungu: string | null;
  site_count: number | null;
  active_subscription: number | null;
  unsold_count: number | null;
  redev_count: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialRegion?: string | null;
}

export default function RegionPicker({ open, onClose, initialRegion }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<SummaryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(initialRegion ?? null);
  const [search, setSearch] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  // open 상태가 true 가 된 시점에만 v_apt_region_summary fetch (모달 닫힐 때 메모리 보존, 재열기 시 재사용).
  useEffect(() => {
    if (!open || rows !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data, error: err } = await (sb as any)
          .from('v_apt_region_summary')
          .select('region, sigungu, site_count, active_subscription, unsold_count, redev_count');
        if (cancelled) return;
        if (err) {
          setError(err.message || 'fetch failed');
          setRows([]);
        } else {
          setRows((data as SummaryRow[]) || []);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'unknown');
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, rows, loading]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 시도 별 합산 (sigungu IS NULL row 가 시도 합계, sigungu 행은 시군구별 분해).
  // v_apt_region_summary 가 (region, NULL) + (region, sigungu) 모두 노출하는 가정.
  const sidoCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows || []) {
      if (r.sigungu === null && r.region) map.set(r.region, r.site_count ?? 0);
    }
    // 누락된 시도는 0 으로 채움.
    for (const sido of KR_REGIONS_17) {
      if (!map.has(sido)) map.set(sido, 0);
    }
    return map;
  }, [rows]);

  const sigunguList = useMemo(() => {
    if (!activeRegion) return [];
    const list = (rows || []).filter(r => r.region === activeRegion && r.sigungu);
    list.sort((a, b) => (b.site_count ?? 0) - (a.site_count ?? 0));
    return list;
  }, [rows, activeRegion]);

  const searchHits = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const needle = q.toLowerCase();
    return (rows || [])
      .filter(r => r.sigungu && (
        r.sigungu.toLowerCase().includes(needle) ||
        (r.region && r.region.toLowerCase().includes(needle))
      ))
      .slice(0, 30);
  }, [rows, search]);

  const choose = (region: string, sigungu: string | null) => {
    setStoredRegion(region, sigungu);
    const params = new URLSearchParams();
    params.set('region', region);
    if (sigungu) params.set('sigungu', sigungu);
    router.replace(`/apt?${params.toString()}`);
    try { document.cookie = `kd_region=${encodeURIComponent(region)}; path=/; max-age=${60*60*24*365}; samesite=lax`; } catch {}
    onClose();
  };

  async function tryGeolocation() {
    if (!navigator.geolocation) { alert('위치 권한을 사용할 수 없습니다'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(`/api/region/from-coords?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          if (!r.ok) throw new Error('geocoding failed');
          const j = await r.json();
          if (j.region) choose(j.region, j.sigungu || null);
          else alert('현재 위치의 지역을 찾을 수 없어요');
        } catch { alert('현재 위치 조회에 실패했어요'); }
        finally { setGeoLoading(false); }
      },
      () => { alert('위치 권한이 거부되었습니다'); setGeoLoading(false); },
      { timeout: 8000, maximumAge: 60000 }
    );
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="지역 선택"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 32px)',
          background: 'var(--bg-base)', borderRadius: 14,
          border: '1px solid var(--border)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>지역 선택</span>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >×</button>
        </div>

        {/* 검색 */}
        <div style={{ padding: '12px 16px 6px' }}>
          <input
            type="text" inputMode="text"
            placeholder="🔍 시·군·구 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              fontSize: 13, color: 'var(--text-primary)',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)', borderRadius: 10,
              outline: 'none',
            }}
          />
        </div>

        {/* 빠른 액션 */}
        <div style={{ display: 'flex', gap: 8, padding: '6px 16px 12px' }}>
          <button
            onClick={tryGeolocation}
            disabled={geoLoading}
            style={pillStyle()}
          >{geoLoading ? '위치 조회 중...' : '📍 현재 위치'}</button>
          <button
            onClick={() => {
              setStoredRegion('전국', null);
              router.replace('/apt?region=전국');
              onClose();
            }}
            style={pillStyle()}
          >전국 보기</button>
        </div>

        {/* 본문 — 검색 모드 vs 시도/시군구 모드 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
              불러오는 중...
            </div>
          )}
          {error && (
            <div style={{ padding: 12, background: 'var(--bg-hover)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
              지역 데이터 로드 실패. 시도만 직접 선택 가능합니다.
            </div>
          )}

          {/* 검색 결과 우선 노출 */}
          {!loading && search.trim() && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchHits.length === 0 ? (
                <div style={{ padding: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>일치 없음</div>
              ) : searchHits.map((r) => (
                <button
                  key={`${r.region}-${r.sigungu}`}
                  onClick={() => choose(r.region, r.sigungu)}
                  style={rowBtnStyle()}
                >
                  <span>{r.region} · {r.sigungu}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(r.site_count ?? 0).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {/* 시도 그리드 (검색 비어있을 때) */}
          {!loading && !search.trim() && !activeRegion && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
              {KR_REGIONS_17.map((sido) => {
                const cnt = sidoCounts.get(sido) ?? 0;
                return (
                  <button
                    key={sido}
                    onClick={() => setActiveRegion(sido)}
                    style={tileStyle()}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{sido}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{cnt.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 시군구 단계 */}
          {!loading && !search.trim() && activeRegion && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 8px' }}>
                <button
                  onClick={() => setActiveRegion(null)}
                  style={{ background: 'transparent', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                >‹ 시도 다시 선택</button>
                <button
                  onClick={() => choose(activeRegion, null)}
                  style={{ ...pillStyle(), padding: '5px 10px' }}
                >{activeRegion} 전체 보기</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {sigunguList.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>
                    시군구 데이터 없음 — {activeRegion} 전체 보기로 진입하세요.
                  </div>
                ) : sigunguList.map((r) => (
                  <button
                    key={`${r.region}-${r.sigungu}`}
                    onClick={() => choose(r.region, r.sigungu!)}
                    style={rowBtnStyle()}
                  >
                    <span>{r.sigungu}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(r.site_count ?? 0).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function pillStyle(): React.CSSProperties {
  return {
    padding: '9px 14px', borderRadius: 999,
    fontSize: 13, fontWeight: 700,
    background: 'var(--bg-hover)', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', cursor: 'pointer',
  };
}

function tileStyle(): React.CSSProperties {
  return {
    padding: '14px 8px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--bg-hover)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    cursor: 'pointer',
  };
}

function rowBtnStyle(): React.CSSProperties {
  return {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px', borderRadius: 8,
    background: 'var(--bg-hover)', border: '1px solid var(--border)',
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
    cursor: 'pointer', textAlign: 'left',
  };
}
