export default function EmptyState({ icon, title, description, action }: {
  icon: string; title: string; description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-secondary)' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>{icon}</div>
      <h3 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:'0 0 8px' }}>{title}</h3>
      {description && <p style={{ fontSize:14, margin:'0 0 20px' }}>{description}</p>}
      {action && (
        <a href={action.href} style={{
          display:'inline-block', background:'var(--brand)', color:'var(--text-inverse)',
          padding:'10px 24px', borderRadius:20, textDecoration:'none', fontWeight:700
        }}>{action.label}</a>
      )}
    </div>
  );
}
