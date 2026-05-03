'use client';

/**
 * s224 — 지역 필터 인라인 드릴다운 (B+A 하이브리드)
 *
 * 변경 사항 (vs 기존 RegionHeader + RegionPicker 모달):
 * 1. 모달 제거 → 헤더 바로 아래 펼치는 인라인 드로어
 * 2. breadcrumb 형식 (`📍 부산 › 연제구 ▾`) — 어느 부분 탭해도 그 단계로 점프
 * 3. 드로어 안에 검색창 + 즐겨찾기 + 현재 단계 가로 스크롤 칩 + ↑ 상위로
 * 4. 검색 자동완성 즉시 표시 (시·군·구 전국 매칭)
 * 5. 페이지 라우팅 시 scroll 보존 (`router.replace(..., { scroll: false })`)
 * 6. 드로어 닫기는 ESC / 외부 클릭 / 선택 후 자동.
 *
 * 동(dong) 단계는 의도적으로 미포함 — 사용자 결정 (시군구까지만).
 * "📍 내 위치" 는 기존 RegionAutoSelect (저장값 + TZ fallback) 그대로 사용.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { KR_REGIONS_17, setStoredRegion } from '@/lib/region-storage';

interface SummaryRow {
  region: string;
  sigungu: string | null;
  site_count: number | null;
}

interface FavoriteEntry {
  region: string;
  sigungu: string | null;
  ts: number;
}

const FAV_KEY = 'kadeora_region_fav_v1';
const RECENT_KEY = 'kadeora_region_recent_v1';
const MAX_RECENT = 5;
const MAX_FAV = 8;

interface Props {
  region: string;
  sigungu: string | null;
}

export default function RegionHeader({ region, sigungu }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SummaryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [recents, setRecents] = useState<FavoriteEntry[]>([]);
  const drawerRef = useRef<HTMLDivElement>(null);

  // URL → localStorage 동기화 + 최근 기록
  useEffect(() => {
    if (!region) return;
    setStoredRegion(region, sigungu);
    pushRecent(region, sigungu, setRecents);
  }, [region, sigungu]);

  // 즐겨찾기/최근 로드
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const f = localStorage.getItem(FAV_KEY);
      if (f) setFavorites(JSON.parse(f));
      const r = localStorage.getItem(RECENT_KEY);
      if (r) setRecents(JSON.parse(r));
    } catch { /* ignore */ }
  }, []);

  // 드로어 열릴 때 region summary fetch (한 번만)
  useEffect(() => {
    if (!open || rows !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data } = await (sb as any)
          .from('v_apt_region_summary')
          .select('region, sigungu, site_count');
        if (cancelled) return;
        setRows((data as SummaryRow[]) || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, rows, loading]);

  // ESC 닫기 + 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  // 시군구 집계 (sigungu 행만)
  const sigunguByRegion = useMemo(() => {
    const map = new Map<string, SummaryRow[]>();
    for (const r of rows || []) {
      if (r.sigungu && r.region) {
        const list = map.get(r.region) || [];
        list.push(r);
        map.set(r.region, list);
      }
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (b.site_count ?? 0) - (a.site_count ?? 0));
    }
    return map;
  }, [rows]);

  // 시도별 합계
  const sidoCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows || []) {
      if (r.sigungu === null && r.region) map.set(r.region, r.site_count ?? 0);
    }
    return map;
  }, [rows]);

  // 검색 자동완성
  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !rows) return [];
    return rows
      .filter(r => r.sigungu && (
        r.sigungu.toLowerCase().includes(q) ||
        (r.region && r.region.toLowerCase().includes(q))
      ))
      .slice(0, 12);
  }, [rows, search]);

  // 선택 → URL 변경 (scroll 보존)
  const choose = (nextRegion: string, nextSigungu: string | null) => {
    setStoredRegion(nextRegion, nextSigungu);
    pushRecent(nextRegion, nextSigungu, setRecents);
    const params = new URLSearchParams();
    params.set('region', nextRegion);
    if (nextSigungu) params.set('sigungu', nextSigungu);
    // scroll: false — 스크롤 위치 보존이 이번 개선의 핵심
    router.replace(`/apt?${params.toString()}`, { scroll: false });
    setOpen(false);
    setSearch('');
  };

  const toggleFavorite = () => {
    const exists = favorites.some(f => f.region === region && f.sigungu === sigungu);
    let next: FavoriteEntry[];
    if (exists) {
      next = favorites.filter(f => !(f.region === region && f.sigungu === sigungu));
    } else {
      next = [{ region, sigungu, ts: Date.now() }, ...favorites].slice(0, MAX_FAV);
    }
    setFavorites(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const isFav = favorites.some(f => f.region === region && f.sigungu === sigungu);
  const isAll = region === '전국';

  return (
    <div
      ref={drawerRef}
      role="banner"
      style={{ position: 'sticky', top: 44, zIndex: 50, background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}
    >
      {/* === Breadcrumb 헤더 === */}
      <div style={{ padding: '8px var(--sp-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
          <span aria-hidden style={{ fontSize: 14, marginRight: 4 }}>📍</span>
          <button
            onClick={() => { setOpen(true); setSearch(''); }}
            style={{
              background: 'transparent', border: 'none', padding: '4px 6px',
              fontSize: 13, fontWeight: 800, color: 'var(--text-primary)',
              cursor: 'pointer', borderRadius: 6,
            }}
          >{isAll ? '전국' : region}</button>
          {sigungu && (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>›</span>
              <button
                onClick={() => { setOpen(true); setSearch(''); }}
                style={{
                  background: 'var(--brand-bg)', border: '1px solid var(--brand-border)',
                  padding: '3px 9px', borderRadius: 999,
                  fontSize: 12, fontWeight: 700, color: 'var(--brand)',
                  cursor: 'pointer',
                }}
              >{sigungu}</button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={toggleFavorite}
            aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 등록'}
            style={{
              width: 32, height: 28, borderRadius: 999, fontSize: 12,
              background: isFav ? 'var(--accent-yellow-bg)' : 'transparent',
              color: isFav ? 'var(--accent-yellow)' : 'var(--text-tertiary)',
              border: `1px solid ${isFav ? 'var(--accent-yellow)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}
          >{isFav ? '★' : '☆'}</button>
          <button
            onClick={() => { setOpen(o => !o); setSearch(''); }}
            aria-expanded={open}
            style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: open ? 'var(--brand)' : 'var(--bg-hover)',
              color: open ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${open ? 'var(--brand)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}
          >지역 변경 {open ? '▴' : '▾'}</button>
        </div>
      </div>

      {/* === Drawer === */}
      {open && (
        <div
          role="dialog" aria-label="지역 선택"
          style={{
            borderTop: '1px solid var(--border)', background: 'var(--bg-surface)',
            maxHeight: '70vh', overflowY: 'auto', padding: '12px var(--sp-lg) 16px',
          }}
        >
          <input
            type="text" inputMode="text" autoFocus
            placeholder="🔍 시·군·구 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', boxSizing: 'border-box',
              fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-base)',
              border: '1px solid var(--border)', borderRadius: 10, outline: 'none', marginBottom: 10,
            }}
          />

          {search.trim() && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
              {loading && <div style={loadingStyle}>불러오는 중…</div>}
              {!loading && searchHits.length === 0 && <div style={emptyStyle}>일치 없음</div>}
              {searchHits.map((r) => (
                <button key={`${r.region}-${r.sigungu}`} onClick={() => choose(r.region, r.sigungu)} style={searchRowStyle}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{r.region}</span> · <strong style={{ fontWeight: 700 }}>{r.sigungu}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(r.site_count ?? 0).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {!search.trim() && (
            <>
              {favorites.length > 0 && (
                <Section title="★ 즐겨찾기">
                  <ChipRow>
                    {favorites.map((f) => (
                      <Chip key={`fav-${f.region}-${f.sigungu}`} active={f.region === region && f.sigungu === sigungu} onClick={() => choose(f.region, f.sigungu)}>
                        {f.sigungu ? `${f.region} ${f.sigungu}` : f.region}
                      </Chip>
                    ))}
                  </ChipRow>
                </Section>
              )}
              {recents.length > 0 && (
                <Section title="🕐 최근">
                  <ChipRow>
                    {recents.map((r, i) => (
                      <Chip key={`rc-${i}-${r.region}-${r.sigungu}`} active={r.region === region && r.sigungu === sigungu} onClick={() => choose(r.region, r.sigungu)}>
                        {r.sigungu ? `${r.region} ${r.sigungu}` : r.region}
                      </Chip>
                    ))}
                  </ChipRow>
                </Section>
              )}
              {!isAll && sigunguByRegion.has(region) && (
                <Section title={`${region} 시·군·구`}>
                  <ChipRow>
                    <Chip active={!sigungu} onClick={() => choose(region, null)}>전체</Chip>
                    {(sigunguByRegion.get(region) || []).map((r) => (
                      <Chip key={`sg-${r.sigungu}`} active={r.sigungu === sigungu} onClick={() => choose(r.region, r.sigungu)}>
                        {r.sigungu}
                        <span style={{ marginLeft: 4, opacity: 0.65, fontSize: 10 }}>{(r.site_count ?? 0)}</span>
                      </Chip>
                    ))}
                  </ChipRow>
                </Section>
              )}
              <Section title="시·도">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                  <button onClick={() => choose('전국', null)} style={tileStyle(isAll)}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>전국</span>
                  </button>
                  {KR_REGIONS_17.map((sido) => {
                    const cnt = sidoCount.get(sido) ?? 0;
                    const isCurrent = sido === region && !sigungu;
                    return (
                      <button key={sido} onClick={() => choose(sido, null)} style={tileStyle(isCurrent)}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{sido}</span>
                        {cnt > 0 && <span style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>{cnt.toLocaleString()}</span>}
                      </button>
                    );
                  })}
                </div>
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function pushRecent(region: string, sigungu: string | null, setRecents: (r: FavoriteEntry[]) => void) {
  if (typeof window === 'undefined') return;
  if (region === '전국') return;
  try {
    const cur = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as FavoriteEntry[];
    const filtered = cur.filter(r => !(r.region === region && r.sigungu === sigungu));
    const next = [{ region, sigungu, ts: Date.now() }, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecents(next);
  } catch { /* ignore */ }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 700, letterSpacing: 0.4 }}>{title}</div>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{children}</div>;
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: active ? 'var(--brand)' : 'var(--bg-base)',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}

function tileStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '10px 4px', borderRadius: 8,
    background: active ? 'var(--brand)' : 'var(--bg-base)',
    color: active ? '#fff' : 'var(--text-primary)',
    border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
    cursor: 'pointer', minHeight: 48,
  };
}

const searchRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '9px 11px', borderRadius: 6,
  background: 'var(--bg-base)', border: '1px solid var(--border)',
  cursor: 'pointer', textAlign: 'left',
};

const loadingStyle: React.CSSProperties = {
  padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12,
};

const emptyStyle: React.CSSProperties = {
  padding: 12, color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center',
};
