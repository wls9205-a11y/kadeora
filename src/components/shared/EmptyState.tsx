import Link from 'next/link';

interface Props {
  icon: string; // emoji
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function EmptyState({ icon, title, description, actionLabel, actionHref }: Props) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 16 }}>{description}</div>}
      {actionLabel && actionHref && (
        <Link href={actionHref} style={{
          display: 'inline-block', padding: '8px 20px', borderRadius: 20,
          background: 'var(--brand)', color: 'white', fontSize: 'var(--fs-sm)',
          fontWeight: 700, textDecoration: 'none',
        }}>{actionLabel}</Link>
      )}
    </div>
  );
}
