import React from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface Props {
  slug: string;
  builder?: string | null;
}

interface NearbyRow {
  nearby_slug: string;
  nearby_name: string;
  nearby_dong?: string | null;
  nearby_lifecycle?: string | null;
  rn?: number | null;
}

interface SiblingRow {
  sibling_slug: string;
  sibling_name: string;
  sibling_region?: string | null;
  sibling_sigungu?: string | null;
  sibling_lifecycle?: string | null;
  rn?: number | null;
}

const ALERT_TYPES = [
  { key: 'model_house', label: '모델하우스 오픈', defaultOn: true },
  { key: 'd3', label: '청약 D-3', defaultOn: true },
  { key: 'cheongak_match', label: '가점 매칭', defaultOn: true },
  { key: 'price_change', label: '분양가 변동 ±5%', defaultOn: true },
  { key: 'new_review', label: '새 후기 등록', defaultOn: false },
  { key: 'lifecycle', label: 'lifecycle 단계 변경', defaultOn: false },
];

export default async function AptSidebar({ slug, builder }: Props) {
  const sb = getSupabaseAdmin();
  const [nearbyRes, siblingsRes] = await Promise.all([
    (sb as any).from('v_apt_nearby_sites')
      .select('nearby_slug,nearby_name,nearby_dong,nearby_lifecycle,rn')
      .eq('source_slug', slug)
      .lte('rn', 3)
      .order('rn', { ascending: true }),
    builder
      ? (sb as any).from('v_apt_same_builder')
          .select('sibling_slug,sibling_name,sibling_region,sibling_sigungu,sibling_lifecycle,rn')
          .eq('source_slug', slug)
          .lte('rn', 3)
          .order('rn', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const nearby = ((nearbyRes as any)?.data ?? []) as NearbyRow[];
  const siblings = ((siblingsRes as any)?.data ?? []) as SiblingRow[];

  const cardCss: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, margin: '0 0 12px' };
  const titleCss: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

  return (
    <aside aria-label="단지 사이드바" className="apt-sidebar">
      {/* 1. 알림 받기 — Phase 4 6단계 */}
      <section style={cardCss}>
        <div style={titleCss}>
          <span>알림 받기</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--kd-accent)', padding: '2px 6px', borderRadius: 999, background: 'var(--kd-accent-soft)', border: '1px solid var(--kd-accent-border)' }}>
            6단계
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ALERT_TYPES.map(a => (
            <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                <span style={{ color: a.defaultOn ? 'var(--kd-accent)' : 'var(--text-tertiary)', marginRight: 6, fontSize: 14 }}>{a.defaultOn ? '●' : '○'}</span>
                {a.label}
              </span>
              <span style={{ color: a.defaultOn ? 'var(--kd-accent)' : 'var(--text-tertiary)', fontWeight: 800, fontSize: 10 }}>
                {a.defaultOn ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
          관심 등록 후 마이페이지에서 변경
        </div>
      </section>

      {/* 2. 인근 단지 */}
      {nearby.length > 0 && (
        <section style={cardCss}>
          <div style={titleCss}>
            <span>인근 단지</span>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>top {nearby.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nearby.map(n => (
              <Link key={n.nearby_slug} href={`/apt/${encodeURIComponent(n.nearby_slug)}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.nearby_name}
                  </span>
                  {n.nearby_dong && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{n.nearby_dong}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. 같은 시공사 */}
      {builder && siblings.length > 0 && (
        <section style={cardCss}>
          <div style={titleCss}>
            <span>{builder}</span>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>다른 단지</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {siblings.map(s => (
              <Link key={s.sibling_slug} href={`/apt/${encodeURIComponent(s.sibling_slug)}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.sibling_name}
                  </span>
                  {s.sibling_sigungu && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{s.sibling_sigungu}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
