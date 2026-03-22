'use client';

const shimmer = `
@keyframes kd-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

function Bone({ w, h = 16, r = 6, mb = 0 }: { w?: string | number; h?: number; r?: number; mb?: number }) {
  return (
    <div style={{
      width: w ?? '100%', height: h, borderRadius: r, marginBottom: mb,
      background: 'linear-gradient(90deg, var(--bg-hover) 25%, var(--bg-surface) 50%, var(--bg-hover) 75%)',
      backgroundSize: '800px 100%',
      animation: 'kd-shimmer 1.5s ease-in-out infinite',
    }} />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Bone w={36} h={36} r={18} />
          <div style={{ flex: 1 }}>
            <Bone w="40%" h={14} mb={6} />
            <Bone w="25%" h={10} />
          </div>
        </div>
        <Bone w="85%" h={18} mb={8} />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <Bone key={i} w={`${70 - i * 15}%`} h={14} mb={6} />
        ))}
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <Bone w={50} h={14} />
          <Bone w={50} h={14} />
          <Bone w={50} h={14} />
        </div>
      </div>
    </>
  );
}

export function SkeletonStockRow() {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        <Bone w={40} h={40} r={8} />
        <div style={{ flex: 1 }}>
          <Bone w="50%" h={14} mb={4} />
          <Bone w="30%" h={10} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <Bone w={60} h={14} mb={4} />
          <Bone w={40} h={10} />
        </div>
      </div>
    </>
  );
}

export function SkeletonAptCard() {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <Bone w="60%" h={18} />
          <Bone w={50} h={22} r={4} />
        </div>
        <Bone w="80%" h={13} mb={6} />
        <Bone w="45%" h={13} mb={10} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Bone w="33%" h={28} r={6} />
          <Bone w="33%" h={28} r={6} />
          <Bone w="33%" h={28} r={6} />
        </div>
      </div>
    </>
  );
}

export function SkeletonChart({ height = 200 }: { height?: number }) {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16, marginBottom: 10,
      }}>
        <Bone w="30%" h={16} mb={12} />
        <Bone h={height} r={8} />
      </div>
    </>
  );
}

export function SkeletonDashboard() {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <Bone w="50%" h={12} mb={8} />
            <Bone w="70%" h={24} mb={4} />
            <Bone w="40%" h={10} />
          </div>
        ))}
      </div>
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
    </>
  );
}

export function SkeletonList({ count = 5, type = 'card' }: { count?: number; type?: 'card' | 'stock' | 'apt' }) {
  const Component = type === 'stock' ? SkeletonStockRow : type === 'apt' ? SkeletonAptCard : SkeletonCard;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </>
  );
}
