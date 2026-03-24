import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Disclaimer from '@/components/Disclaimer';

const AptPriceTrendChart = dynamic(() => import('@/components/charts/AptPriceTrendChart'));
const AptReviewSection = dynamic(() => import('@/components/AptReviewSection'));

export const revalidate = 3600;

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('apt_sites')
    .select('slug')
    .eq('is_active', true)
    .gte('content_score', 25)
    .limit(10000);
  return ((data || []) as any[]).map(s => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sb = getSupabaseAdmin();
  const { data: site } = await (sb as any).from('apt_sites')
    .select('name, seo_title, seo_description, region, sigungu, site_type, total_units, price_min, price_max, builder')
    .eq('slug', decodeURIComponent(slug)).single();
  if (!site) return {};

  const typeLabel: Record<string, string> = {
    subscription: '분양정보 · 청약일정',
    redevelopment: '재개발 · 진행현황',
    unsold: '미분양 현황',
    landmark: '실거래가 · 시세',
    complex: '실거래가 · 시세 추이',
  };
  const title = site.seo_title || `${site.name} ${typeLabel[site.site_type] || '분양정보'} | 카더라`;
  const units = site.total_units ? `${site.total_units.toLocaleString()}세대` : '';
  const price = site.price_min && site.price_max
    ? `분양가 ${(site.price_min / 10000).toFixed(1)}~${(site.price_max / 10000).toFixed(1)}억`
    : site.price_min ? `분양가 ${(site.price_min / 10000).toFixed(1)}억~` : '';
  const desc = site.seo_description || `${site.region || ''} ${site.sigungu || ''} ${site.name} ${units} ${site.builder || ''} ${price}. 청약일정, 실거래가, 주민리뷰까지 한눈에.`;

  return {
    title,
    description: desc.trim(),
    alternates: { canonical: `${SITE_URL}/apt/sites/${slug}` },
    openGraph: {
      title,
      description: desc.trim(),
      url: `${SITE_URL}/apt/sites/${slug}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
    },
  };
}

function fmtAmount(n: number | null) {
  if (!n) return '-';
  return n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
}

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12 };
const cardTitle: React.CSSProperties = { fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' };
const rowLabel: React.CSSProperties = { color: 'var(--text-tertiary)' };
const rowVal: React.CSSProperties = { color: 'var(--text-primary)', fontWeight: 600 };

export default async function SiteDetailPage({ params }: Props) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const sb = await createSupabaseServer();

  const { data: site } = await (sb as any).from('apt_sites').select('*').eq('slug', decoded).single();
  if (!site) notFound();

  // 페이지뷰 증가 (비동기, 에러 무시)
  const admin = getSupabaseAdmin();
  try { await (admin as any).rpc('increment_site_view', { p_site_id: site.id }); } catch {}

  const sourceIds = (site.source_ids || {}) as Record<string, string>;
  const hasSub = !!sourceIds.subscription_id;
  const hasRedev = !!sourceIds.redev_id;
  const hasUnsold = !!sourceIds.unsold_id;
  const redevStage = sourceIds.redev_stage;

  // 관련 데이터 fetch
  let subData: any = null;
  let trades: any[] = [];
  let relatedBlogs: any[] = [];
  let relatedPosts: any[] = [];
  let nearbySites: any[] = [];

  try {
    if (hasSub) {
      const { data } = await sb.from('apt_subscriptions').select('*')
        .eq('id', Number(sourceIds.subscription_id)).single();
      subData = data;
    }
  } catch {}

  try {
    const { data } = await sb.from('apt_transactions')
      .select('id, apt_name, deal_date, deal_amount, exclusive_area, floor')
      .eq('apt_name', site.name).order('deal_date', { ascending: false }).limit(30);
    trades = data || [];
  } catch {}

  try {
    const searchTerm = site.name.length > 4 ? site.name.slice(0, 4) : site.name;
    const { data } = await sb.from('blog_posts').select('slug, title, view_count, published_at')
      .eq('is_published', true).ilike('title', `%${searchTerm}%`)
      .order('view_count', { ascending: false }).limit(4);
    relatedBlogs = data || [];
  } catch {}

  try {
    const searchTerm = site.name.length > 3 ? site.name.slice(0, 3) : site.name;
    const { data } = await sb.from('posts').select('id, title, created_at, comments_count')
      .eq('is_deleted', false).ilike('title', `%${searchTerm}%`)
      .order('created_at', { ascending: false }).limit(3);
    relatedPosts = data || [];
  } catch {}

  try {
    const { data } = await (sb as any).from('apt_sites').select('slug, name, site_type, region, sigungu, total_units, status')
      .eq('is_active', true).eq('region', site.region || '').neq('id', site.id)
      .gte('content_score', 25).order('interest_count', { ascending: false }).limit(4);
    nearbySites = data || [];
  } catch {}

  const typeLabel: Record<string, string> = { subscription: '분양', redevelopment: '재개발', unsold: '미분양', landmark: '랜드마크', complex: '기존단지' };
  const typeBg: Record<string, string> = { subscription: 'rgba(52,211,153,0.2)', redevelopment: 'rgba(183,148,255,0.15)', unsold: 'rgba(255,107,107,0.15)', landmark: 'rgba(56,189,248,0.15)', complex: 'rgba(56,189,248,0.15)' };
  const typeColor: Record<string, string> = { subscription: '#2EE8A5', redevelopment: '#B794FF', unsold: '#FF6B6B', landmark: '#38BDF8', complex: '#38BDF8' };

  const features = Array.isArray(site.key_features) ? site.key_features : [];
  const faqItems = Array.isArray(site.faq_items) ? site.faq_items as { q: string; a: string }[] : [];
  const noindex = site.content_score < 40;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {noindex && <meta name="robots" content="noindex,follow" />}

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'ApartmentComplex',
        name: site.name,
        address: { '@type': 'PostalAddress', addressRegion: site.region, addressLocality: site.sigungu || '', streetAddress: site.address || '' },
        ...(site.total_units ? { numberOfRooms: site.total_units } : {}),
        ...(site.latitude && site.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: site.latitude, longitude: site.longitude } } : {}),
        url: `${SITE_URL}/apt/sites/${slug}`,
      }) }} />
      {faqItems.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: faqItems.map(f => ({
            '@type': 'Question', name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
          { '@type': 'ListItem', position: 3, name: site.region || '전국', item: `${SITE_URL}/apt/region/${encodeURIComponent(site.region || '')}` },
          { '@type': 'ListItem', position: 4, name: site.name, item: `${SITE_URL}/apt/sites/${slug}` },
        ],
      }) }} />

      {/* 뒤로가기 */}
      <Link href="/apt/sites" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'block', padding: '12px 0 6px' }}>
        ← 현장 목록
      </Link>

      {/* 뱃지 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 700, background: typeBg[site.site_type], color: typeColor[site.site_type], border: `1px solid ${typeColor[site.site_type]}33` }}>
          {typeLabel[site.site_type] || '분양'}
        </span>
        {redevStage && (
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 700, background: 'rgba(255,212,59,0.15)', color: '#FFD43B', border: '1px solid rgba(255,212,59,0.25)' }}>
            {redevStage}
          </span>
        )}
        {site.status === 'active' && site.site_type === 'subscription' && (
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 700, background: 'rgba(59,123,246,0.1)', color: '#6CB4FF', border: '1px solid rgba(59,123,246,0.2)' }}>
            분양중
          </span>
        )}
      </div>

      {/* 현장명 */}
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px', lineHeight: 1.3 }}>
        {site.name}
      </h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 14px' }}>
        {[site.region, site.sigungu, site.dong].filter(Boolean).join(' ')}
        {site.builder ? ` · ${site.builder} 시공` : ''}
      </p>

      {/* 핵심 수치 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
        {[
          { label: '세대수', value: site.total_units ? `${site.total_units.toLocaleString()}` : '-', color: 'var(--text-primary)' },
          { label: site.site_type === 'subscription' ? '분양가' : '시세', value: site.price_min || site.price_max ? `${fmtAmount(site.price_min)}~${fmtAmount(site.price_max)}` : '-', color: 'var(--brand)' },
          { label: '입주예정', value: site.move_in_date ? site.move_in_date.slice(0, 7).replace('-', '.') : '-', color: 'var(--success)' },
          { label: '관심고객', value: `${site.interest_count || 0}명`, color: '#FFD43B' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 특징 태그 */}
      {features.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {features.map((f: string, i: number) => (
            <span key={i} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 'var(--fs-xs)', fontWeight: 600, background: 'rgba(59,123,246,0.1)', color: '#6CB4FF', border: '1px solid rgba(59,123,246,0.15)' }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {/* AI 설명 */}
      {site.description && (
        <div style={{ ...card, background: 'var(--bg-elevated)', borderLeft: '3px solid var(--brand)', borderRadius: 0, padding: '12px 16px' }}>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{site.description}</p>
        </div>
      )}

      {/* ━━━ 프로젝트 개요 (청약) ━━━ */}
      {subData && (
        <div style={card}>
          <div style={cardTitle}>🏢 프로젝트 개요</div>
          {[
            ['분양유형', subData.mdatrgbn_nm],
            ['시공사', subData.constructor_nm || site.builder],
            ['시행사', subData.developer_nm || site.developer],
            ['총공급', subData.tot_supply_hshld_co ? `${Number(subData.tot_supply_hshld_co).toLocaleString()}세대` : null],
            ['동수', subData.total_dong_co ? `${subData.total_dong_co}개동` : null],
            ['입주예정', subData.mvn_prearnge_ym],
          ].filter(r => r[1]).map(([label, value]) => (
            <div key={label as string} style={row}>
              <span style={rowLabel}>{label}</span>
              <span style={rowVal}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ━━━ 청약 일정 ━━━ */}
      {subData?.rcept_bgnde && (
        <div style={card}>
          <div style={cardTitle}>📅 청약 일정</div>
          {[
            ['특별공급', subData.spsply_rcept_bgnde],
            ['접수시작', subData.rcept_bgnde],
            ['접수마감', subData.rcept_endde],
            ['당첨자발표', subData.przwner_presnatn_de],
            ['계약시작', subData.cntrct_cncls_bgnde],
            ['계약마감', subData.cntrct_cncls_endde],
          ].filter(r => r[1]).map(([label, value]) => (
            <div key={label as string} style={row}>
              <span style={rowLabel}>{label}</span>
              <span style={rowVal}>{value}</span>
            </div>
          ))}
          {sourceIds.house_manage_no && (
            <Link href={`/apt/${sourceIds.house_manage_no}`} style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '8px 0', borderRadius: 8, background: 'var(--brand-bg)', color: 'var(--brand)', fontSize: 'var(--fs-sm)', fontWeight: 600, textDecoration: 'none' }}>
              청약 상세 보기 →
            </Link>
          )}
        </div>
      )}

      {/* ━━━ 재개발 진행현황 ━━━ */}
      {hasRedev && redevStage && (
        <div style={card}>
          <div style={cardTitle}>📊 재개발 진행 현황</div>
          {(() => {
            const stages = ['구역지정', '조합설립', '사업시행', '관리처분', '착공', '입주'];
            const currentIdx = stages.findIndex(s => redevStage.includes(s));
            const pct = currentIdx >= 0 ? Math.round(((currentIdx + 1) / stages.length) * 100) : 0;
            return (
              <>
                <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                  {stages.map((s, i) => (
                    <div key={s} style={{
                      flex: 1, textAlign: 'center', padding: '6px 2px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 600,
                      background: i <= currentIdx ? (i === currentIdx ? '#B794FF' : 'rgba(183,148,255,0.2)') : 'var(--bg-hover)',
                      color: i === currentIdx ? 'var(--bg-base)' : (i < currentIdx ? '#B794FF' : 'var(--text-tertiary)'),
                    }}>{s}</div>
                  ))}
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: '#B794FF' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  <span>구역지정</span><span style={{ color: '#B794FF', fontWeight: 700 }}>{redevStage} ({pct}%)</span><span>입주</span>
                </div>
              </>
            );
          })()}
          {site.developer && <div style={{ ...row, borderBottom: 'none' }}><span style={rowLabel}>시행사/조합</span><span style={rowVal}>{site.developer}</span></div>}
          {site.builder && <div style={{ ...row, borderBottom: 'none' }}><span style={rowLabel}>시공사</span><span style={rowVal}>{site.builder}</span></div>}
        </div>
      )}

      {/* ━━━ 실거래가 ━━━ */}
      {trades.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>💰 실거래 이력 ({trades.length}건)</div>
          <AptPriceTrendChart aptName={site.name} region={site.region || ''} />
          {trades.slice(0, 10).map((t, i) => (
            <div key={t.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < 9 ? '1px solid var(--border)' : 'none', fontSize: 'var(--fs-sm)' }}>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>{t.deal_date}</span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{t.exclusive_area}㎡ · {t.floor}층</span>
              </div>
              <span style={{ fontWeight: 700, color: t.deal_amount >= 100000 ? 'var(--error)' : t.deal_amount >= 50000 ? '#FFB06A' : 'var(--success)' }}>
                {fmtAmount(t.deal_amount)}
              </span>
            </div>
          ))}
          <Link href={`/apt/complex/${encodeURIComponent(site.name)}`} style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '8px 0', borderRadius: 8, background: 'var(--brand-bg)', color: 'var(--brand)', fontSize: 'var(--fs-sm)', fontWeight: 600, textDecoration: 'none' }}>
            전체 실거래 내역 보기 →
          </Link>
        </div>
      )}

      {/* ━━━ 위치 정보 ━━━ */}
      <div style={card}>
        <div style={cardTitle}>📍 위치 정보</div>
        {site.address && <div style={row}><span style={rowLabel}>주소</span><span style={{ ...rowVal, fontSize: 'var(--fs-xs)' }}>{site.address}</span></div>}
        {site.nearby_station && <div style={row}><span style={rowLabel}>최근접역</span><span style={{ ...rowVal, color: 'var(--success)' }}>{site.nearby_station}</span></div>}
        {site.school_district && <div style={row}><span style={rowLabel}>학군</span><span style={rowVal}>{site.school_district}</span></div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <a href={`https://map.kakao.com/?q=${encodeURIComponent(site.name + ' ' + (site.dong || site.sigungu || ''))}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 카카오맵</a>
          <a href={`https://map.naver.com/p/search/${encodeURIComponent(site.name)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 네이버지도</a>
        </div>
      </div>

      {/* ━━━ 관심고객 등록 CTA ━━━ */}
      <div style={{ background: 'var(--bg-surface)', border: '2px solid var(--brand)', borderRadius: 14, padding: 16, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>관심고객 등록</div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 14 }}>이 현장의 분양 소식을 가장 먼저 받아보세요</p>
        <Link href={`/login?redirect=/apt/sites/${slug}`} style={{ display: 'block', padding: '14px', background: 'var(--brand)', color: '#fff', borderRadius: 10, fontSize: 'var(--fs-base)', fontWeight: 700, textDecoration: 'none' }}>
          로그인하고 등록하기
        </Link>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 10 }}>
          👥 현재 <span style={{ color: 'var(--brand)', fontWeight: 800 }}>{site.interest_count || 0}</span>명이 관심을 보이고 있어요
        </p>
      </div>

      {/* ━━━ 커뮤니티 리뷰 ━━━ */}
      <AptReviewSection aptName={site.name} region={site.region || ''} />

      {/* ━━━ 관련 게시글 ━━━ */}
      {relatedPosts.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>💬 커뮤니티 게시글</div>
          {relatedPosts.map(p => (
            <Link key={p.id} href={`/feed/${p.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}>
              <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
              <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>댓글 {p.comments_count || 0}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ━━━ 관련 블로그 ━━━ */}
      {relatedBlogs.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>📰 관련 분석 블로그</div>
          {relatedBlogs.map(b => (
            <Link key={b.slug} href={`/blog/${b.slug}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--fs-sm)' }}>
              <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
              <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontSize: 'var(--fs-xs)' }}>👀 {(b.view_count || 0).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ━━━ 같은 지역 다른 현장 ━━━ */}
      {nearbySites.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>🏗️ {site.region} 다른 현장</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {nearbySites.map(ns => (
              <Link key={ns.slug} href={`/apt/sites/${ns.slug}`} className="kd-card" style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{ns.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  {ns.sigungu || ns.region} · {ns.total_units ? `${ns.total_units}세대` : ''} · {typeLabel[ns.site_type]}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ━━━ FAQ ━━━ */}
      {faqItems.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>❓ 자주 묻는 질문</div>
          {faqItems.map((f, i) => (
            <details key={i} style={{ borderBottom: i < faqItems.length - 1 ? '1px solid var(--border)' : 'none', padding: '10px 0' }}>
              <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
                <span>{f.q}</span><span style={{ color: 'var(--text-tertiary)' }}>+</span>
              </summary>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0 0', paddingLeft: 0 }}>{f.a}</p>
            </details>
          ))}
        </div>
      )}

      {/* 면책 */}
      <Disclaimer />

      {/* 출처 */}
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '8px 0 40px', lineHeight: 1.6 }}>
        📊 데이터 출처: 국토교통부 · 청약홈 · 한국부동산원 · 각 지자체
      </p>
    </div>
  );
}
