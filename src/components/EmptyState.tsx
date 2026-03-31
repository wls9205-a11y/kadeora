import Link from 'next/link';

export default function EmptyState({ icon, title, description, action, suggestions }: {
  icon: string; title: string; description?: string;
  action?: { label: string; href: string };
  suggestions?: { label: string; href: string }[];
}) {
  return (
    <div className="kd-fade-in" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(46,232,165,0.06))',
        border: '1px solid rgba(59,123,246,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 18px', fontSize: 36, lineHeight: 1,
      }}>{icon}</div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.3px' }}>{title}</h3>
      {description && <p style={{ fontSize: 'var(--fs-sm)', margin: '0 0 20px', lineHeight: 1.6, color: 'var(--text-tertiary)', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>{description}</p>}
      {action && (
        <Link href={action.href} className="kd-btn-glow" style={{
          display: 'inline-block',
          padding: '11px 28px', borderRadius: 'var(--radius-full)', textDecoration: 'none',
          fontSize: 'var(--fs-sm)',
        }}>{action.label}</Link>
      )}
      {suggestions && suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'center', flexWrap: 'wrap', marginTop: 'var(--sp-lg)' }}>
          {suggestions.map(s => (
            <Link key={s.href} href={s.href} style={{
              fontSize: 'var(--fs-xs)', padding: '6px 14px', borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600,
              transition: 'border-color var(--transition-fast)',
            }}>{s.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
