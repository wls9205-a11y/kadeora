import Link from 'next/link';

export default function EmptyState({ icon, title, description, action }: {
  icon: string; title: string; description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 52, marginBottom: 16, lineHeight: 1 }}>{icon}</div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h3>
      {description && <p style={{ fontSize: 'var(--fs-sm)', margin: '0 0 20px', lineHeight: 1.5 }}>{description}</p>}
      {action && (
        <Link href={action.href} style={{
          display: 'inline-block', background: 'var(--brand)', color: 'var(--text-inverse)',
          padding: '10px 24px', borderRadius: 'var(--radius-full)', textDecoration: 'none',
          fontWeight: 700, fontSize: 'var(--fs-sm)', transition: 'opacity var(--transition-fast)',
        }}>{action.label}</Link>
      )}
    </div>
  );
}
