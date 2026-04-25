'use client';
export default function FallbackThumb({ name, size = 32 }: { name: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 8,
      flexShrink: 0,
      background: `hsl(${hue},45%,25%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 800,
      color: `hsl(${hue},60%,70%)`,
    }}>
      {(name && name[0]) || '?'}
    </div>
  );
}
