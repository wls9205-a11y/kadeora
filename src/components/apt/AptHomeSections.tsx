import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import HomeSiteCard, { type HomeSiteRow } from '@/components/apt/HomeSiteCard';
import LandmarkCard, { type LandmarkRow } from '@/components/apt/LandmarkCard';

interface SectionsPayload {
  popular: HomeSiteRow[];
  unsold: HomeSiteRow[];
  landmark: LandmarkRow[];
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>{title}</span>
      <Link
        href={href}
        style={{ fontSize: 11, color: 'var(--text-secondary, #888)', textDecoration: 'none', fontWeight: 600 }}
      >
        전체 보기 →
      </Link>
    </div>
  );
}

export default async function AptHomeSections() {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).rpc('get_apt_homepage_sections', { p_limit: 6 });
  const s = (data ?? { popular: [], unsold: [], landmark: [] }) as SectionsPayload;

  const popular = Array.isArray(s.popular) ? s.popular : [];
  const unsold = Array.isArray(s.unsold) ? s.unsold : [];
  const landmark = Array.isArray(s.landmark) ? s.landmark : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 20 }}>
      {popular.length > 0 && (
        <section aria-label="지금 인기 단지">
          <SectionHeader title="🔥 지금 인기 단지" href="/apt/popular" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {popular.map((r) => <HomeSiteCard key={r.id} row={r} variant="popular" />)}
          </div>
        </section>
      )}

      {unsold.length > 0 && (
        <section aria-label="미분양 기회">
          <SectionHeader title="💸 미분양 기회" href="/apt/unsold-deals" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {unsold.map((r) => <HomeSiteCard key={r.id} row={r} variant="unsold" />)}
          </div>
        </section>
      )}

      {landmark.length > 0 && (
        <section aria-label="랜드마크 단지">
          <SectionHeader title="🏆 랜드마크 단지" href="/apt/landmark" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {landmark.map((r) => <LandmarkCard key={r.id} row={r} />)}
          </div>
        </section>
      )}
    </div>
  );
}
