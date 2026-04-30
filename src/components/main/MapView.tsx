/**
 * MapView — 메인 페이지 v5 지도뷰 (server component).
 * SVG 360x200 inline. 한국 단순 outline + 모드별 점.
 * mode 4종: subscription/trade/unsold/redev. 점 색상 매핑.
 * lat/lng 좌표 있을 때만 점 렌더, 없으면 "지도 데이터 없음" overlay.
 */
import MapModeToggle from './MapModeToggle';
import type { MainListing, MainTransaction, MainUnsold, MainRedev, MainRegion } from './types';

type MapMode = 'subscription' | 'trade' | 'unsold' | 'redev';
type MapItem = (MainListing | MainTransaction | MainUnsold | MainRedev) & { latitude?: number | null; longitude?: number | null; lat?: number | null; lng?: number | null };

interface Props {
  items: MapItem[];
  mode: MapMode;
  activeRegion: MainRegion;
}

const COLOR: Record<MapMode, string> = {
  subscription: 'var(--brand)',
  trade: 'var(--accent-green, #22c55e)',
  unsold: 'var(--accent-orange, #f97316)',
  redev: 'var(--accent-purple, #a855f7)',
};

// 대한민국 단순화 outline (대략적, viewBox 0 0 360 200)
const KR_OUTLINE = 'M120 25 L150 20 L180 25 L210 35 L240 50 L270 65 L290 85 L300 110 L295 135 L280 155 L255 170 L220 175 L185 170 L155 165 L130 155 L110 140 L100 120 L95 95 L100 70 L110 45 Z';

function project(lat: number, lng: number): { x: number; y: number } | null {
  if (lat < 33 || lat > 38.6 || lng < 125 || lng > 131) return null;
  const y = ((38.6 - lat) / 5.6) * 200;
  const x = ((lng - 125) / 6) * 360;
  return { x, y };
}

function getCoords(item: MapItem): { lat: number; lng: number } | null {
  const lat = item.latitude ?? item.lat ?? null;
  const lng = item.longitude ?? item.lng ?? null;
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  return null;
}

export default function MapView({ items, mode, activeRegion }: Props) {
  const points = items
    .map(getCoords)
    .filter((c): c is { lat: number; lng: number } => c !== null)
    .map((c) => project(c.lat, c.lng))
    .filter((p): p is { x: number; y: number } => p !== null);

  const color = COLOR[mode];
  const hasData = points.length > 0;

  return (
    <section style={{ padding: 16, border: '0.5px solid var(--border)', borderRadius: 12, background: 'var(--bg-base)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          지도뷰 <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 4 }}>· {activeRegion === 'all' ? '전국' : ''}</span>
        </h2>
        <MapModeToggle mode={mode} />
      </div>
      <div style={{ position: 'relative', width: '100%', height: 200, background: 'var(--bg-surface)', borderRadius: 8, overflow: 'hidden' }}>
        <svg width="100%" height="200" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          <path d={KR_OUTLINE} fill="var(--bg-hover, rgba(255,255,255,0.04))" stroke="var(--border)" strokeWidth="0.5" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} opacity="0.7" />
          ))}
        </svg>
        {!hasData && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: 'var(--text-tertiary)', pointerEvents: 'none',
            }}
          >
            지도 데이터 없음
          </div>
        )}
      </div>
    </section>
  );
}
