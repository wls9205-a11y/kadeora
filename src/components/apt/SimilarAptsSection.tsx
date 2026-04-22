/**
 * SimilarAptsSection — apt/[id] 하단 "유사 단지 6곳" 그리드.
 *
 * get_similar_apts(p_apt_site_id uuid, p_limit int default 3) RPC → jsonb 배열.
 * 서버 컴포넌트. 데이터 없으면 null.
 */

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import SimilarAptsTracker from './SimilarAptsTracker';

interface SimilarRow {
  id: string;
  name: string;
  region?: string | null;
  sigungu?: string | null;
  site_type?: string | null;
  og_image_url?: string | null;
  satellite_image_url?: string | null;
  slug?: string | null;
}

interface Props {
  aptSiteId: string;
  limit?: number;
}

async function fetchSimilar(aptSiteId: string, limit: number): Promise<SimilarRow[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await (admin as any).rpc('get_similar_apts', {
      p_apt_site_id: aptSiteId,
      p_limit: limit,
    });
    if (!Array.isArray(data)) return [];
    return data as SimilarRow[];
  } catch {
    return [];
  }
}

export default async function SimilarAptsSection({ aptSiteId, limit = 6 }: Props) {
  if (!aptSiteId) return null;
  const rows = await fetchSimilar(aptSiteId, limit);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label="유사 단지"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--card-p) var(--sp-lg)',
        marginBottom: 'var(--sp-md)',
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
        🏘 비슷한 단지
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {rows.map((r, idx) => {
          const thumb = r.satellite_image_url || r.og_image_url || `/api/og?title=${encodeURIComponent(r.name)}`;
          const regionLabel = [r.region, r.sigungu].filter(Boolean).join(' ');
          const href = r.slug ? `/apt/${r.slug}` : `/apt/${r.id}`;
          return (
            <Link
              key={r.id}
              href={href}
              data-similar-apt-card
              data-similar-idx={idx}
              style={{
                display: 'block',
                textDecoration: 'none',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--bg-hover)',
                color: 'var(--text-primary)',
                transition: 'transform 0.12s, border-color 0.12s',
              }}
            >
              <div
                style={{
                  aspectRatio: '4 / 3',
                  background: `url('${thumb}') center/cover no-repeat`,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                }}
                aria-hidden
              />
              <div style={{ padding: '8px 10px' }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name}
                </div>
                {regionLabel && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{regionLabel}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      {/* C3: 3번째 카드 view/click 로깅 (apt_compare_unlock_logs) */}
      <SimilarAptsTracker aptSiteId={aptSiteId} thirdCardId={rows[2]?.id || null} />
    </section>
  );
}
