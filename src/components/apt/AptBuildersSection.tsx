// 서버 — fetchBuilders 결과 link list.
import Link from 'next/link';
import type { BuilderRow } from '@/lib/apt-fetcher';

function shortBuilder(name: string): string {
  return name.replace(/\(주\)|주식회사|\s+/g, '').slice(0, 12);
}

interface Props {
  builders: BuilderRow[];
  region: string;
}

export default function AptBuildersSection({ builders, region }: Props) {
  if (!builders || builders.length === 0) return null;
  return (
    <section
      aria-label={`${region} 주요 시공사`}
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        🏗️ {region === '전국' ? '주요 시공사' : `${region} 주요 시공사`}
      </h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {builders.map((b) => (
          <Link
            key={b.builder}
            href={`/apt/builder/${encodeURIComponent(b.builder)}`}
            style={{
              padding: '6px 12px', borderRadius: 999,
              fontSize: 11, fontWeight: 700,
              background: 'var(--bg-surface)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', textDecoration: 'none',
            }}
          >
            {shortBuilder(b.builder)} <span style={{ color: 'var(--brand)', fontWeight: 800 }}>({b.count})</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
