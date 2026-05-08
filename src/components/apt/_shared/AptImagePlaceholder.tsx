type Props = { name?: string; size?: number; aspectRatio?: string };

export default function AptImagePlaceholder({ name, size = 60, aspectRatio = '4/3' }: Props) {
  void size;
  return (
    <div style={{
      width: '100%', aspectRatio, position: 'relative',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #4a90c2 100%)',
      borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMax meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }}>
        {/* simple building skyline */}
        <rect x="6"  y="38" width="11" height="22" fill="rgba(255,255,255,0.6)" />
        <rect x="20" y="28" width="14" height="32" fill="rgba(255,255,255,0.7)" />
        <rect x="36" y="22" width="10" height="38" fill="rgba(255,255,255,0.65)" />
        <rect x="48" y="32" width="13" height="28" fill="rgba(255,255,255,0.55)" />
        <rect x="63" y="18" width="11" height="42" fill="rgba(255,255,255,0.7)" />
        <rect x="76" y="30" width="14" height="30" fill="rgba(255,255,255,0.6)" />
      </svg>
      <span style={{ position: 'relative', zIndex: 1, fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
        사진 준비중{name ? ` · ${name.slice(0, 12)}` : ''}
      </span>
    </div>
  );
}
