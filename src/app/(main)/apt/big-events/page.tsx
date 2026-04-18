import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 900;

export const metadata: Metadata = {
  title: '전국 재건축·재개발 대형 이벤트 모음 — 카더라',
  description:
    '삼익비치·은마·잠실·목동 등 전국 주요 재건축·재개발 단지의 현재 Stage, 브랜드, 시공사, 세대수를 한눈에. 카더라 데이터 기반 분석.',
  alternates: { canonical: `${SITE_URL}/apt/big-events` },
  openGraph: {
    title: '전국 재건축·재개발 대형 이벤트 — 카더라',
    description: '재건축·재개발 Stage·브랜드·시공사 한눈에 정리',
    url: `${SITE_URL}/apt/big-events`,
    siteName: '카더라',
    type: 'website',
    locale: 'ko_KR',
  },
  robots: { index: true, follow: true },
};

const STAGE_LABEL: Record<number, string> = {
  1: '논의·추진위',
  2: '조합설립',
  3: '사업시행',
  4: '관리처분·이주',
  5: '철거·착공',
  6: '일반분양',
  7: '입주·준공',
};

const REGION_TABS: { key: string; label: string; match: (sido: string) => boolean }[] = [
  { key: 'all', label: '전국', match: () => true },
  { key: 'seoul', label: '서울', match: (s) => /서울/.test(s || '') },
  { key: 'busan', label: '부산', match: (s) => /부산/.test(s || '') },
  { key: 'gyeonggi', label: '경기', match: (s) => /경기/.test(s || '') },
  { key: 'incheon', label: '인천', match: (s) => /인천/.test(s || '') },
  { key: 'daegu', label: '대구', match: (s) => /대구/.test(s || '') },
  { key: 'etc', label: '기타', match: (s) => !/서울|부산|경기|인천|대구/.test(s || '') },
];

interface SearchProps { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function BigEventsHubPage({ searchParams }: SearchProps) {
  const sp = await searchParams;
  const activeRegion = typeof sp.region === 'string' ? sp.region : 'all';
  const activeStage = typeof sp.stage === 'string' ? sp.stage : 'all';

  const sb = await createSupabaseServer();
  const { data: eventsRaw } = await (sb as any)
    .from('big_event_registry')
    .select('id, slug, name, full_name, region_sido, region_sigungu, region_dong, event_type, stage, scale_before, scale_after, key_constructors, new_brand_name, constructor_status, pillar_blog_post_id, priority_score, is_active, notes')
    .eq('is_active', true)
    .order('priority_score', { ascending: false, nullsFirst: false })
    .limit(200);

  const events: any[] = Array.isArray(eventsRaw) ? eventsRaw : [];

  // Pillar slug 일괄 조회
  const pillarIds = events.map((e: any) => e.pillar_blog_post_id).filter(Boolean);
  const pillarSlugMap = new Map<number, string>();
  if (pillarIds.length > 0) {
    const { data: pillars } = await sb.from('blog_posts').select('id, slug').in('id', pillarIds as any);
    (pillars || []).forEach((p: any) => pillarSlugMap.set(p.id, p.slug));
  }

  // 활성 탭 필터 적용
  const regionDef = REGION_TABS.find((t) => t.key === activeRegion) || REGION_TABS[0];
  const filtered = events.filter((e: any) => {
    if (!regionDef.match(e.region_sido || '')) return false;
    if (activeStage !== 'all' && String(e.stage || '') !== activeStage) return false;
    return true;
  });

  // 지역별 카운트
  const regionCounts = REGION_TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.key] = events.filter((e: any) => t.match(e.region_sido || '')).length;
    return acc;
  }, {});

  const stages = Array.from(new Set(events.map((e: any) => e.stage).filter((s) => typeof s === 'number'))).sort((a: number, b: number) => a - b);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: filtered.slice(0, 30).map((e: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: pillarSlugMap.get(e.pillar_blog_post_id)
        ? `${SITE_URL}/blog/${pillarSlugMap.get(e.pillar_blog_post_id)}`
        : `${SITE_URL}/apt/big-events`,
      name: `${e.name} ${e.event_type || '재건축'}`,
    })),
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

      <nav aria-label="breadcrumb" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <Link href="/apt" style={{ color: 'inherit', textDecoration: 'none' }}>아파트</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <span>대형 이벤트</span>
      </nav>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
        전국 재건축·재개발 대형 이벤트
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.7 }}>
        카더라가 추적하는 전국 주요 정비사업 단지 {events.length}곳의 현재 Stage·브랜드·시공사·세대수를 한눈에. 모든 정보는 공공 데이터와 내부 노트를 기반으로 하며, 수주 미확정 항목은 투명하게 표시합니다.
      </p>

      {/* 지역 탭 */}
      <div role="tablist" aria-label="지역 필터" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 6 }}>
        {REGION_TABS.map((t) => {
          const active = t.key === activeRegion;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={active}
              href={`/apt/big-events?region=${t.key}${activeStage !== 'all' ? `&stage=${activeStage}` : ''}`}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                border: '1px solid var(--border)',
                background: active ? 'var(--brand)' : 'var(--bg-surface)',
                color: active ? '#fff' : 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              {t.label} {regionCounts[t.key] ?? 0}
            </Link>
          );
        })}
      </div>

      {/* Stage 필터 */}
      {stages.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          <Link
            href={`/apt/big-events?region=${activeRegion}`}
            style={{
              flexShrink: 0,
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              border: '1px solid var(--border)',
              background: activeStage === 'all' ? 'var(--bg-hover)' : 'transparent',
              color: activeStage === 'all' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              textDecoration: 'none',
            }}
          >
            전체 Stage
          </Link>
          {stages.map((s: number) => {
            const active = String(s) === activeStage;
            return (
              <Link
                key={s}
                href={`/apt/big-events?region=${activeRegion}&stage=${s}`}
                style={{
                  flexShrink: 0,
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: active ? 'var(--bg-hover)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  textDecoration: 'none',
                }}
              >
                Stage {s} · {STAGE_LABEL[s]}
              </Link>
            );
          })}
        </div>
      )}

      {/* 카드 그리드 */}
      {filtered.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
          해당 조건의 이벤트가 아직 없습니다. 카더라가 지속적으로 업데이트 중입니다.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((e: any) => {
            const slug = pillarSlugMap.get(e.pillar_blog_post_id);
            const cardContent = (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--brand-bg)', color: 'var(--brand)' }}>
                    Stage {e.stage ?? '-'} {STAGE_LABEL[e.stage] ? `· ${STAGE_LABEL[e.stage]}` : ''}
                  </span>
                  {e.constructor_status && e.constructor_status !== 'confirmed' && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--warning-bg, rgba(234,179,8,0.08))', color: 'var(--text-tertiary)' }}>
                      {e.constructor_status === 'likely' ? '수주 유력' : '수주 미확정'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {e.name}
                  {e.new_brand_name ? <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13 }}> · {e.new_brand_name}</span> : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {e.region_sido || ''} {e.region_sigungu || ''} {e.region_dong || ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {e.scale_before ?? '?'}세대 → <strong style={{ color: 'var(--text-primary)' }}>{e.scale_after ?? '?'}+세대</strong>
                  {Array.isArray(e.key_constructors) && e.key_constructors.length > 0 && (
                    <> · {e.key_constructors.join(', ')}</>
                  )}
                </div>
              </>
            );
            const baseStyle = {
              display: 'block',
              padding: '14px 16px',
              borderRadius: 'var(--radius-card)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'inherit',
            } as const;
            return (
              <li key={e.id}>
                {slug ? (
                  <Link href={`/blog/${slug}`} style={baseStyle}>{cardContent}</Link>
                ) : (
                  <div style={baseStyle} aria-label={`${e.name} 상세 글 준비 중`}>
                    {cardContent}
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>상세 분석 준비 중</div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 20, lineHeight: 1.6 }}>
        ⚠️ 수주사·브랜드·세대수·일정은 공공 데이터 기준 최신 업데이트입니다. 확정되지 않은 정보는 &quot;수주 유력&quot;/&quot;수주 미확정&quot;로 표시합니다. 본 페이지는 투자자문이 아닙니다.
      </p>
    </div>
  );
}
