import Link from 'next/link';

interface Props {
  targetDate?: string | null;
  status?: string;
  ctaHref?: string;
}

export default function AptDDayCard({ targetDate, status, ctaHref }: Props) {
  if (!targetDate) return null;

  const target = new Date(targetDate);
  if (isNaN(target.getTime())) return null;

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffMs = startTarget.getTime() - startToday.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays < 0) return null;

  const label = diffDays === 0 ? 'D-Day' : `D-${diffDays}`;
  const href = ctaHref || '#alert';

  return (
    <div className="apt-dday-card">
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>
          청약 마감까지
        </div>
        <div className="apt-dday-number" style={{ fontSize: 36, fontWeight: 900, color: 'var(--brand)', lineHeight: 1 }}>
          {label}
        </div>
        {status && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{status}</div>
        )}
      </div>
      <Link
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--brand)',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 700,
          marginTop: 12,
        }}
      >
        청약 알림 받기 →
      </Link>
    </div>
  );
}
