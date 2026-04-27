import Link from 'next/link';

export interface RelatedAptSite {
  slug: string;
  name: string;
  region?: string | null;
  sigungu?: string | null;
  status?: string | null;
}

interface Props {
  sites: RelatedAptSite[];
  heading?: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: '접수중',
  upcoming: '접수예정',
  closed: '마감',
};

export default function RelatedAptSites({ sites, heading = '관련 청약·분양 현장' }: Props) {
  if (!sites || sites.length === 0) return null;
  return (
    <section
      style={{
        margin: '32px 0',
        padding: '20px 18px',
        border: '1px solid var(--border)',
        borderRadius: 14,
        background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)' }}>
        {heading}
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sites.slice(0, 6).map(s => {
          const label = s.status ? STATUS_LABEL[s.status] || s.status : null;
          return (
            <li key={s.slug}>
              <Link
                href={`/apt/${encodeURIComponent(s.slug)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  textDecoration: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong style={{ fontWeight: 700 }}>{s.name}</strong>
                  {(s.region || s.sigungu) && (
                    <span style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
                      {[s.region, s.sigungu].filter(Boolean).join(' ')}
                    </span>
                  )}
                </span>
                {label && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(0,255,135,0.14)',
                      color: '#00FF87',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
