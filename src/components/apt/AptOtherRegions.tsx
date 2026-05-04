// 서버 — 현재 region 외 시도 빠른 이동 링크. v_apt_region_summary 의 region-level totals (sigungu IS NULL) 로 정렬.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { KR_REGIONS_17 } from '@/lib/region-storage';

interface Props {
  current?: string | null;
}

export default async function AptOtherRegions({ current }: Props) {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any)
    .from('v_apt_region_summary')
    .select('region, site_count')
    .is('sigungu', null);

  const counts: Record<string, number> = {};
  (data || []).forEach((r: any) => {
    counts[r.region] = Number(r.site_count) || 0;
  });

  const others = KR_REGIONS_17.filter((r) => r !== current).sort(
    (a, b) => (counts[b] || 0) - (counts[a] || 0)
  );

  return (
    <section
      aria-label="다른 지역"
      style={{ maxWidth: 720, margin: '16px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        📍 다른 지역 보기
      </h2>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {others.map((r) => {
          const c = counts[r] || 0;
          const label = c >= 10 ? `${r} (${c.toLocaleString()})` : r;
          return (
            <Link
              key={r}
              href={`/apt?region=${encodeURIComponent(r)}`}
              style={{
                padding: '8px 14px', borderRadius: 999,
                fontSize: 12, fontWeight: 700,
                background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
