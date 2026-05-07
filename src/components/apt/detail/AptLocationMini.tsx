interface Props {
  address?: string;
  latitude?: number;
  longitude?: number;
  nearbyStation?: string;
  schoolDistrict?: string;
}

export default function AptLocationMini({ address, latitude, longitude, nearbyStation, schoolDistrict }: Props) {
  if (!address) return null;

  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

  return (
    <div className="apt-location-mini" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)', margin: '12px 0' }}>
      {hasCoords && (
        <div
          className="apt-location-map-placeholder"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 80, borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(139,92,246,0.06))',
            border: '1px dashed var(--border)',
            fontSize: 28,
          }}
        >
          📍
        </div>
      )}
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{address}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {nearbyStation && (
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
            🚉 {nearbyStation}
          </span>
        )}
        {schoolDistrict && (
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
            🎓 {schoolDistrict}
          </span>
        )}
      </div>
    </div>
  );
}
