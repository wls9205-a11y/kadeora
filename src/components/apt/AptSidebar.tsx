import React from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface Props {
  slug: string;
  builder?: string | null;
  /** v10-B8: 비로그인에는 알림 토글 6줄을 내지 않는다. */
  isLoggedIn?: boolean;
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

export default async function AptSidebar({ slug, builder, isLoggedIn = false }: Props) {
  const sb = getSupabaseAdmin();
  // s227: v_apt_nearby_sites view (24만 rows window 함수, 평균 750ms) →
  //         get_apt_nearby_sites RPC (직접 region/sigungu join, 3ms 검증).
  const [nearbyRes, siblingsRes] = await Promise.all([
    (sb as any).rpc('get_apt_nearby_sites', { p_source_slug: slug, p_limit: 3 }),
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
  const titleCss: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

  return (
    <aside aria-label="단지 사이드바" className="apt-sidebar">
      {/* v10-B8: 비로그인에 ON/OFF 6줄을 내지 않는다 — 켤 수 없는 토글 6줄은
           설정처럼 보이지만 아무것도 안 되는 화면이다. 한 줄 안내 + 로그인 링크로 줄이고
           토글은 로그인 상태에서만 편다. */}
      <section style={cardCss}>
        <div style={titleCss}><span>알림 받기</span></div>
        {isLoggedIn ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ALERT_TYPES.map(a => (
                <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <span style={{ color: a.defaultOn ? 'var(--kd-accent)' : 'var(--text-tertiary)', marginRight: 6, fontSize: 'var(--fs-sm)' }}>{a.defaultOn ? '●' : '○'}</span>
                    {a.label}
                  </span>
                  <span style={{ color: a.defaultOn ? 'var(--kd-accent)' : 'var(--text-tertiary)', fontWeight: 800, fontSize: 'var(--fs-xs)' }}>
                    {a.defaultOn ? 'ON' : 'OFF'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              마이페이지에서 변경
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--fs-xs)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            모델하우스 오픈 · 청약 D-3 · 분양가 변동 알림을 받을 수 있습니다.{' '}
            <Link href="/login" style={{ color: 'var(--kd-accent)', fontWeight: 700, textDecoration: 'none' }}>로그인 →</Link>
          </p>
        )}
      </section>

      {/* v10-B5: '인근 단지' 삭제 — 인근 단지 비교표(AptCompareTable)와 내용이 겹친다.
           탐색은 우측 레일의 '같은 지역 현장' 이 담당한다. */}

      {/* 3. 같은 시공사 */}
      {builder && siblings.length > 0 && (
        <section style={cardCss}>
          <div style={titleCss}>
            <span>{builder}</span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>다른 단지</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {siblings.map(s => (
              <Link key={s.sibling_slug} href={`/apt/${encodeURIComponent(s.sibling_slug)}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.sibling_name}
                  </span>
                  {s.sibling_sigungu && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{s.sibling_sigungu}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
