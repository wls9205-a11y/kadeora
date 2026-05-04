'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setStoredRegion } from '@/lib/region-storage';

interface Sido { name: string; count: number }
interface Props { onClose: () => void; sido: Sido[]; currentRegion: string }

const FAV_KEY = 'kadeora_region_fav_v1';
const RECENT_KEY = 'kadeora_region_recent_v1';

export default function RegionSheetV5({ onClose, sido, currentRegion }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [favs, setFavs] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]'));
      setRecents(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]').slice(0, 5));
    } catch {}
  }, []);

  const pick = (name: string) => {
    try {
      setStoredRegion(name);
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]').filter((x: string) => x !== name);
      r.unshift(name);
      localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 8)));
    } catch {}
    router.replace(name === '전국' ? '/apt' : `/apt?region=${encodeURIComponent(name)}`, { scroll: false });
    onClose();
  };

  const toggleFav = (name: string) => {
    const next = favs.includes(name) ? favs.filter((x) => x !== name) : [...favs, name].slice(0, 6);
    setFavs(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {}
  };

  const useGeo = async () => {
    if (!('geolocation' in navigator)) return;
    setGeoLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      const r = await fetch(`/api/region/from-coords?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
      const j = await r.json();
      if (j?.region) pick(j.region);
    } catch {} finally { setGeoLoading(false); }
  };

  const filtered = search ? sido.filter((s) => s.name.includes(search.trim())) : sido;

  return (
    <div
      role="dialog"
      aria-label="지역 선택"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
          background: 'var(--bg-elevated, #1f2028)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
          padding: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <input
            type="search"
            placeholder="지역 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '0.5px solid var(--border, #2a2b35)', background: 'var(--bg-base, #0d0e14)', color: 'var(--text-primary, #fff)', fontSize: 12, outline: 'none', height: 32 }}
          />
          <button
            onClick={useGeo}
            aria-label="내 위치"
            disabled={geoLoading}
            style={{ padding: '0 10px', height: 32, borderRadius: 8, border: '0.5px solid var(--border-strong, #3a3b45)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}
          >
            {geoLoading ? '…' : '📍'}
          </button>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ width: 32, height: 32, border: 0, background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-secondary, #888)', flexShrink: 0, fontSize: 16 }}
          >✕</button>
        </div>

        {favs.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary, #666)', marginBottom: 4, padding: '0 2px' }}>즐겨찾기</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {favs.map((name) => (
                <button key={name} onClick={() => pick(name)} style={{ padding: '5px 10px', borderRadius: 999, border: '0.5px solid var(--border, #2a2b35)', background: 'transparent', fontSize: 11, color: 'var(--text-primary, #fff)', cursor: 'pointer' }}>⭐ {name}</button>
              ))}
            </div>
          </div>
        )}

        {recents.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary, #666)', marginBottom: 4, padding: '0 2px' }}>최근 본 지역</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {recents.map((name) => (
                <button key={name} onClick={() => pick(name)} style={{ padding: '5px 10px', borderRadius: 999, border: '0.5px solid var(--border, #2a2b35)', background: 'transparent', fontSize: 11, color: 'var(--text-primary, #fff)', cursor: 'pointer' }}>{name}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {filtered.map((s) => {
            const isFav = favs.includes(s.name);
            const isCur = currentRegion === s.name;
            return (
              <div
                key={s.name}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                  border: '0.5px solid ' + (isCur ? '#3b82f6' : 'var(--border, #2a2b35)'),
                  background: isCur ? 'rgba(59,130,246,0.15)' : 'transparent',
                  position: 'relative',
                }}
                onClick={() => pick(s.name)}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>{s.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary, #888)' }}>{s.count.toLocaleString()}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFav(s.name); }}
                  aria-label="즐겨찾기"
                  style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, border: 0, background: 'transparent', cursor: 'pointer', fontSize: 10, padding: 0, opacity: isFav ? 1 : 0.3 }}
                >⭐</button>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary, #888)', fontSize: 11 }}>검색 결과 없음</div>}

        <button
          onClick={() => pick('전국')}
          style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 8, border: 0, background: 'var(--bg-base, #0d0e14)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #fff)' }}
        >전국 보기</button>
      </div>
    </div>
  );
}
