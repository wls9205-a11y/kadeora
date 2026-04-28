// 서버 — 현재 region 외 16 시도 빠른 이동 링크.
import Link from 'next/link';
import { KR_REGIONS_17 } from '@/lib/region-storage';

interface Props {
  current: string;
}

export default function AptOtherRegions({ current }: Props) {
  const others = KR_REGIONS_17.filter((r) => r !== current);
  return (
    <section
      aria-label="다른 지역"
      style={{ maxWidth: 720, margin: '16px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        📍 다른 지역 보기
      </h2>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {others.map((r) => (
          <Link
            key={r}
            href={`/apt?region=${encodeURIComponent(r)}`}
            style={{
              padding: '5px 12px', borderRadius: 999,
              fontSize: 11, fontWeight: 700,
              background: 'var(--bg-surface)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', textDecoration: 'none',
            }}
          >
            {r}
          </Link>
        ))}
      </div>
    </section>
  );
}
