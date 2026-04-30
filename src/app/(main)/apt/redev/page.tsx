import { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 3600; // 1시간 캐시

const OG_IMAGE = `${SITE_URL}/api/og?title=${encodeURIComponent('전국 재개발·재건축 현황')}&category=apt&design=2`;

export const metadata: Metadata = {
  // s212 P0-B: template 가 '| 카더라' 자동 추가
  title: '재개발 재건축 현황 — 전국 정비사업 진행 단계·시공사·세대수',
  description: '서울·경기·부산 등 전국 재개발·재건축 구역의 진행 단계, 시공사, 세대수, 용적률, 분담금 정보를 한눈에. 정비구역지정부터 착공까지 단계별 현황과 AI 투자 분석.',
  keywords: ['재개발', '재건축', '재개발 현황', '재건축 현황', '정비사업', '신통기획', '분담금', '입주권', '재개발 투자', '재건축 투자', '정비구역', '관리처분', '조합설립', '사업시행인가'],
  alternates: { canonical: `${SITE_URL}/apt/redev` },
  openGraph: {
    title: '재개발·재건축 현황 — 전국 정비사업 진행 단계 | 카더라',
    description: '전국 재개발·재건축 구역의 진행 단계, 시공사, 세대수, 분담금 정보. 매주 자동 업데이트.',
    url: `${SITE_URL}/apt/redev`,
    type: 'website',
    siteName: '카더라',
    locale: 'ko_KR',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: '카더라 재개발·재건축 현황' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '재개발·재건축 현황 | 카더라',
    description: '전국 정비사업 진행 단계·시공사·세대수 한눈에',
    images: [OG_IMAGE],
  },
  other: {
    'naver:site_name': '카더라',
    'naver:author': '카더라 부동산팀',
  },
};

const STAGE_COLORS: Record<string, string> = {
  '추진위': '#94A3B8', '정비구역지정': '#6B7280', '조합설립': '#60A5FA',
  '사업시행인가': '#FBBF24', '관리처분': '#FB923C', '착공': '#34D399', '준공': '#3B82F6',
};

export default async function RedevLandingPage() {
  const sb = await createSupabaseServer();

  // 병렬 데이터 로딩
  const [projectsR, blogR, recentChangeR] = await Promise.all([
    sb.from('redevelopment_projects').select('id, district_name, region, sigungu, project_type, sub_type, stage, total_households, constructor, floor_area_ratio, ai_summary, blog_count, avg_trade_price, last_stage_change, previous_stage').eq('is_active', true).order('region'),
    sb.from('blog_posts').select('slug, title, view_count, created_at').eq('category', 'redev').eq('is_published', true).order('view_count', { ascending: false }).limit(5),
    sb.from('redevelopment_projects').select('id, district_name, region, stage, previous_stage, last_stage_change').eq('is_active', true).not('last_stage_change', 'is', null).order('last_stage_change', { ascending: false }).limit(5),
  ]);

  const projects: any[] = projectsR.data || [];
  const blogs: any[] = blogR.data || [];
  const recentChanges: any[] = recentChangeR.data || [];
  const residential = projects.filter((p: any) => p.sub_type !== '도시환경정비');
  const total = residential.length;

  // 지역별 집계
  const regionMap = new Map<string, { total: number; redev: number; rebuild: number; households: number; withConstructor: number }>();
  residential.forEach((p: any) => {
    const r = p.region || '기타';
    const cur = regionMap.get(r) || { total: 0, redev: 0, rebuild: 0, households: 0, withConstructor: 0 };
    cur.total++;
    if (p.project_type === '재건축') cur.rebuild++; else cur.redev++;
    cur.households += p.total_households || 0;
    if (p.constructor) cur.withConstructor++;
    regionMap.set(r, cur);
  });
  const regionStats = Array.from(regionMap.entries()).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.total - a.total);

  // 단계별 집계
  const stageMap = new Map<string, number>();
  residential.forEach((p: any) => { const s = p.stage || '정비구역지정'; stageMap.set(s, (stageMap.get(s) || 0) + 1); });
  const STAGE_ORDER = ['추진위', '정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공'];

  // JSON-LD — WebPage
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '재개발 재건축 현황',
    description: `전국 ${total}개 재개발·재건축 구역의 진행 단계, 시공사, 세대수 정보`,
    url: `${SITE_URL}/apt/redev`,
    dateModified: new Date().toISOString(),
    publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL },
    image: `${SITE_URL}/api/og?title=${encodeURIComponent('전국 재개발·재건축 현황')}&category=apt&design=2`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
        { '@type': 'ListItem', position: 3, name: '재개발·재건축', item: `${SITE_URL}/apt/redev` },
      ],
    },
  };

  // JSON-LD — ItemList (구글 리치스니펫 목록형 노출)
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '전국 재개발·재건축 구역 목록',
    description: `${total}개 구역의 진행 단계별 현황`,
    numberOfItems: total,
    itemListElement: regionStats.slice(0, 10).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${r.name} 재개발·재건축 (${r.total}건)`,
      url: `${SITE_URL}/apt/redev/${encodeURIComponent(r.name)}`,
      description: `재개발 ${r.redev}건, 재건축 ${r.rebuild}건${r.households > 0 ? `, ${r.households.toLocaleString()}세대` : ''}`,
    })),
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: '재개발과 재건축의 차이는?', acceptedAnswer: { '@type': 'Answer', text: '재개발은 노후 주거지역의 기반시설을 정비하고 주택을 새로 건설하는 사업입니다. 재건축은 기존 아파트나 공동주택을 허물고 새로 짓는 사업으로, 주로 노후 아파트 단지에서 진행됩니다.' } },
      { '@type': 'Question', name: '재개발 투자 시 주의할 점은?', acceptedAnswer: { '@type': 'Answer', text: '사업 진행 단계, 조합 갈등 여부, 용적률 상향 가능성, 시공사 선정 여부, 분담금 수준을 종합적으로 검토해야 합니다. 특히 관리처분 이전 단계는 사업 지연 리스크가 있습니다.' } },
      { '@type': 'Question', name: '신통기획이란?', acceptedAnswer: { '@type': 'Answer', text: '서울시의 신속통합기획 제도로, 정비사업 초기부터 서울시가 기획에 참여하여 인허가 절차를 단축하고 사업성을 보완하는 방식입니다. 2026년 현재 87개소 이상이 대상으로 선정되었습니다.' } },
      { '@type': 'Question', name: '분담금이란?', acceptedAnswer: { '@type': 'Answer', text: '재개발·재건축 조합원이 새 아파트를 분양받기 위해 추가로 부담하는 금액입니다. 기존 물건의 감정가와 신축 분양가의 차액으로, 사업성에 따라 크게 달라집니다.' } },
    ],
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

      {/* 히어로 */}
      <div style={{ padding: '32px 0 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.3 }}>
          🏗️ 전국 재개발·재건축 현황
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          <strong style={{ color: 'var(--brand)', fontSize: 18 }}>{total}</strong>개 구역 · 매주 자동 업데이트
        </p>
      </div>

      {/* 단계별 파이프라인 */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 24 }}>
        {STAGE_ORDER.map(stage => {
          const count = stageMap.get(stage) || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const shortLabel: Record<string, string> = { '추진위': '추진위', '정비구역지정': '구역지정', '조합설립': '조합', '사업시행인가': '시행', '관리처분': '관리', '착공': '착공', '준공': '준공' };
          return (
            <div key={stage} style={{ flex: Math.max(pct, 8), textAlign: 'center', padding: '8px 2px', borderRadius: 'var(--radius-sm)', background: `${STAGE_COLORS[stage]}15`, border: `1px solid ${STAGE_COLORS[stage]}30`, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: STAGE_COLORS[stage] }}>{count}</div>
              <div style={{ fontSize: 9, color: STAGE_COLORS[stage], fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortLabel[stage] || stage}</div>
            </div>
          );
        })}
      </div>

      {/* 지역별 카드 */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>📍 지역별 현황</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 24 }}>
        {regionStats.map(r => (
          <Link key={r.name} href={`/apt/redev/${encodeURIComponent(r.name)}`} style={{
            display: 'block', borderRadius: 'var(--radius-md)', overflow: 'hidden',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            textDecoration: 'none', color: 'inherit', textAlign: 'center',
          }}>
            {/* 세션 139: 지역별 대표 og 썸네일 */}
            <img src={`/api/og?title=${encodeURIComponent(r.name + ' 재개발·재건축')}&design=2&category=apt&subtitle=${encodeURIComponent(`${r.total}개 구역`)}`} alt={`${r.name} 재개발 현황`} width={280} height={88} loading="lazy" decoding="async" style={{ width: '100%', height: 88, objectFit: 'cover', display: 'block', background: 'var(--bg-hover)' }} />
            <div style={{ padding: '10px' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--brand)' }}>{r.total}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>{r.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              재개발 {r.redev} · 재건축 {r.rebuild}
            </div>
            {r.households > 0 && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.households.toLocaleString()}세대</div>}
            {r.withConstructor > 0 && <div style={{ fontSize: 10, color: 'var(--accent-green)' }}>시공사 확정 {r.withConstructor}</div>}
            </div>
          </Link>
        ))}
      </div>

      {/* 최근 단계 변경 */}
      {recentChanges.length > 0 && (<>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>🔄 최근 단계 변경</h2>
        <div style={{ marginBottom: 24 }}>
          {recentChanges.map((c: any) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 4, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{c.district_name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.region}</span>
              {c.previous_stage && <span style={{ fontSize: 11, color: '#EF4444' }}>{c.previous_stage}</span>}
              {c.previous_stage && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>→</span>}
              <span style={{ fontSize: 11, fontWeight: 700, color: STAGE_COLORS[c.stage] || '#10B981' }}>{c.stage}</span>
            </div>
          ))}
        </div>
      </>)}

      {/* 관련 분석 블로그 */}
      {blogs.length > 0 && (<>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>📝 인기 분석</h2>
        <div style={{ marginBottom: 24 }}>
          {blogs.map((b: any, i: number) => (
            <Link key={b.slug} href={`/blog/${b.slug}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              marginBottom: 4, borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 18 }}>#{i + 1}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{b.view_count?.toLocaleString()}뷰</span>
            </Link>
          ))}
        </div>
      </>)}

      {/* 전체 목록 CTA */}
      <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
        <Link href="/apt?tab=redev" style={{
          display: 'inline-block', padding: '12px 32px', borderRadius: 'var(--radius-xl)',
          background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700,
          textDecoration: 'none',
        }}>
          전체 {total}개 구역 보기 →
        </Link>
      </div>

      {/* FAQ 섹션 (SEO) */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '24px 0' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>❓ 자주 묻는 질문</h2>
        {(faqLd.mainEntity as any[]).map((q: any, i: number) => (
          <details key={i} style={{ marginBottom: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <summary style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', background: 'var(--bg-surface)' }}>{q.name}</summary>
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-base)' }}>{q.acceptedAnswer.text}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
