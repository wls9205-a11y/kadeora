import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 900;

interface Props { params: Promise<{ slug: string }> }

const STAGE_LABEL: Record<number, string> = {
  1: '논의·추진위',
  2: '조합설립',
  3: '사업시행',
  4: '관리처분·이주',
  5: '철거·착공',
  6: '일반분양',
  7: '입주·준공',
};

async function fetchEvent(slug: string) {
  const sb = await createSupabaseServer();
  const { data } = await (sb as any)
    .from('big_event_registry')
    .select('*')
    .eq('slug', decodeURIComponent(slug))
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ev = await fetchEvent(slug);
  if (!ev) return { title: '대형 이벤트 | 카더라', robots: { index: false, follow: true } };
  const title = `${ev.name} ${ev.event_type || '재건축'} — Stage ${ev.stage ?? '-'} 상세 분석 | 카더라`;
  const desc = `${ev.region_sido || ''} ${ev.region_sigungu || ''} ${ev.name} ${ev.event_type || '재건축'}: ${ev.scale_before ?? '?'} → ${ev.scale_after ?? '?'}+세대, 브랜드 ${ev.new_brand_name || '미정'} (${ev.constructor_status || 'unconfirmed'}). Stage, 시공사, 타임라인, 관련 블로그 전체 정보.`.slice(0, 170);
  return {
    title,
    description: desc,
    alternates: { canonical: `${SITE_URL}/apt/big-events/${encodeURIComponent(ev.slug)}` },
    openGraph: {
      title,
      description: desc,
      url: `${SITE_URL}/apt/big-events/${encodeURIComponent(ev.slug)}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
    },
    robots: { index: true, follow: true },
  };
}

function scoreTone(score: number | null | undefined): { color: string; bg: string; label: string } {
  const n = Number(score ?? 0);
  if (n >= 70) return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: '높음' };
  if (n >= 50) return { color: '#eab308', bg: 'rgba(234,179,8,0.12)', label: '보통' };
  return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: '낮음' };
}

export default async function BigEventDetailPage({ params }: Props) {
  const { slug } = await params;
  const ev = await fetchEvent(slug);
  if (!ev) return notFound();

  const admin = getSupabaseAdmin();

  const [pillarR, spokesR, milestonesR, assetsR, relatedR] = await Promise.allSettled([
    ev.pillar_blog_post_id
      ? admin.from('blog_posts').select('id, slug, title').eq('id', ev.pillar_blog_post_id).maybeSingle()
      : Promise.resolve({ data: null }),
    Array.isArray(ev.spoke_blog_post_ids) && ev.spoke_blog_post_ids.length > 0
      ? admin.from('blog_posts').select('id, slug, title').in('id', ev.spoke_blog_post_ids as any)
      : Promise.resolve({ data: [] }),
    (admin as any).from('big_event_milestones')
      .select('id, milestone_type, scheduled_at, completed_at, metadata, created_at')
      .eq('event_id', ev.id)
      .order('created_at', { ascending: false })
      .limit(30),
    (admin as any).from('big_event_assets')
      .select('id, asset_type, url, caption, source_label, is_verified, width, height')
      .eq('event_id', ev.id)
      .eq('is_verified', true)
      .limit(12),
    (admin as any).from('big_event_registry')
      .select('id, slug, name, stage, new_brand_name, region_sigungu, pillar_blog_post_id')
      .eq('is_active', true)
      .eq('region_sido', ev.region_sido)
      .neq('id', ev.id)
      .order('priority_score', { ascending: false })
      .limit(6),
  ]);

  const pillar: any = pillarR.status === 'fulfilled' ? (pillarR.value as any)?.data : null;
  const spokes: any[] = spokesR.status === 'fulfilled' ? ((spokesR.value as any)?.data || []) : [];
  const milestones: any[] = milestonesR.status === 'fulfilled' ? ((milestonesR.value as any)?.data || []) : [];
  const assets: any[] = assetsR.status === 'fulfilled' ? ((assetsR.value as any)?.data || []) : [];
  const related: any[] = relatedR.status === 'fulfilled' ? ((relatedR.value as any)?.data || []) : [];

  const since30d = Date.now() - 30 * 24 * 3600 * 1000;
  const recentNews = milestones.filter((m) => m.milestone_type === 'news_detected' && new Date(m.created_at).getTime() >= since30d);

  const tone = scoreTone(ev.fact_confidence_score);

  // JSON-LD Event (Stage 6 임박 시 특히)
  const eventLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${ev.name} ${ev.event_type || '재건축'}`,
    description: `${ev.region_sido} ${ev.region_sigungu} · Stage ${ev.stage ?? '-'} · ${ev.scale_before ?? '?'} → ${ev.scale_after ?? '?'}+세대`,
    startDate: ev.build_year_after_est ? `${ev.build_year_after_est}-01-01` : undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: `${ev.region_sigungu} ${ev.region_dong || ''}`.trim(),
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'KR',
        addressRegion: ev.region_sido,
        addressLocality: ev.region_sigungu,
      },
    },
    organizer: { '@type': 'Organization', name: '카더라', url: SITE_URL },
    url: `${SITE_URL}/apt/big-events/${encodeURIComponent(ev.slug)}`,
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }} />

      <nav aria-label="breadcrumb" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <Link href="/apt" style={{ color: 'inherit', textDecoration: 'none' }}>아파트</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <Link href="/apt/big-events" style={{ color: 'inherit', textDecoration: 'none' }}>대형 이벤트</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <span>{ev.name}</span>
      </nav>

      <header
        style={{
          marginBottom: 18,
          padding: 18,
          borderRadius: 'var(--radius-card, 12px)',
          background: 'linear-gradient(135deg, rgba(59,123,246,0.1), rgba(168,85,247,0.06))',
          border: '1px solid rgba(59,123,246,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--brand-bg, rgba(59,123,246,0.18))', color: 'var(--brand)' }}>
            Stage {ev.stage ?? '-'} / 7 · {STAGE_LABEL[ev.stage ?? 1]}
          </span>
          {ev.constructor_status && ev.constructor_status !== 'confirmed' && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--warning-bg, rgba(234,179,8,0.08))', color: 'var(--text-tertiary)' }}>
              {ev.constructor_status === 'likely' ? '수주 유력' : '수주 미확정'}
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: tone.bg, color: tone.color }}>
            팩트 신뢰도 {ev.fact_confidence_score ?? 0}점 · {tone.label}
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
          {ev.name}
          {ev.new_brand_name ? <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}> · {ev.new_brand_name}</span> : null}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          {ev.region_sido} {ev.region_sigungu} {ev.region_dong || ''} · {ev.event_type || '재건축'} · {ev.scale_before ?? '?'} → <strong style={{ color: 'var(--text-primary)' }}>{ev.scale_after ?? '?'}+세대</strong>
          {Array.isArray(ev.key_constructors) && ev.key_constructors.length > 0 ? <> · 시공 {ev.key_constructors.join(', ')}</> : null}
        </p>
      </header>

      {/* 기본 정보 표 */}
      <section style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>기본 정보</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          <InfoCard label="준공" value={ev.build_year_before ? `${ev.build_year_before}년` : '미상'} />
          <InfoCard label="예상 완공" value={ev.build_year_after_est ? `${ev.build_year_after_est}년` : '미정'} />
          <InfoCard label="현 Stage" value={`${ev.stage ?? '-'} (${STAGE_LABEL[ev.stage ?? 1] || '-'})`} />
          <InfoCard label="세대수" value={`${ev.scale_before ?? '?'} → ${ev.scale_after ?? '?'}+`} />
          <InfoCard label="시공사" value={Array.isArray(ev.key_constructors) ? ev.key_constructors.join(', ') : (ev.key_constructors || '미정')} />
          <InfoCard label="브랜드" value={ev.new_brand_name || '미정'} />
          {ev.apt_complex_profile_id && (
            <InfoCard
              label="단지백과"
              value={<Link href={`/apt/complex/${encodeURIComponent(ev.name)}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>{ev.name} →</Link>}
            />
          )}
        </div>
        {ev.notes && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.6 }}>📝 {ev.notes}</p>
        )}
      </section>

      {/* 관련 블로그 */}
      {(pillar || spokes.length > 0) && (
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>관련 분석 글</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pillar && (
              <li>
                <Link href={`/blog/${pillar.slug}`} style={blogCardStyle}>
                  <span style={pillarBadgeStyle}>Pillar</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{pillar.title}</span>
                </Link>
              </li>
            )}
            {spokes.map((s: any) => (
              <li key={s.id}>
                <Link href={`/blog/${s.slug}`} style={blogCardStyle}>
                  <span style={spokeBadgeStyle}>Spoke</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 이미지 갤러리 (is_verified=true만) */}
      {assets.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>이미지 자료</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {assets.map((a: any) => (
              <figure key={a.id} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.caption || `${ev.name} ${a.asset_type}`}
                  style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, display: 'block', background: 'var(--bg-hover)' }}
                  loading="lazy"
                />
                <figcaption style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {a.caption || a.asset_type} · {a.source_label || '출처 미상'}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 최근 30일 뉴스 */}
      {recentNews.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>최근 30일 뉴스 감지 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{recentNews.length}건</span></h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentNews.slice(0, 10).map((m: any) => {
              const url = m?.metadata?.url || '';
              const title = m?.metadata?.title || '(제목 없음)';
              const critical = m?.metadata?.critical;
              return (
                <li key={m.id} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {critical ? <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>중요</span> : null}
                    <a href={url} rel="nofollow noopener" target="_blank" style={{ fontSize: 12, color: 'var(--text-primary)', textDecoration: 'none' }}>
                      {title}
                    </a>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{m.created_at?.slice(0, 10)} · {m?.metadata?.matched_query || ''}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 타임라인 */}
      {milestones.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>마일스톤 타임라인 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{milestones.length}건</span></h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {milestones.slice(0, 20).map((m: any) => (
              <li key={m.id} style={{ padding: '6px 10px', borderLeft: '3px solid var(--brand)', background: 'var(--bg-surface)', fontSize: 12 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{m.milestone_type}</strong>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>{(m.completed_at || m.scheduled_at || m.created_at || '').slice(0, 10)}</span>
                {m?.metadata?.title ? <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{m.metadata.title}</div> : null}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 같은 시도 다른 이벤트 (cross-link) */}
      {related.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>{ev.region_sido} 다른 대형 이벤트</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {related.map((r: any) => (
              <Link key={r.id} href={`/apt/big-events/${encodeURIComponent(r.slug)}`} style={relatedStyle}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)' }}>Stage {r.stage ?? '-'}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}{r.new_brand_name ? <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}> · {r.new_brand_name}</span> : null}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.region_sigungu}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        ⚠️ 본 페이지의 정보는 공공 데이터·언론·카더라 내부 노트 기반입니다. &quot;수주 유력&quot;·&quot;수주 미확정&quot;은 확정 여부를 투명하게 표기한 것이며, 투자자문이 아닙니다.
      </p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

const blogCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  textDecoration: 'none',
};

const pillarBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(168,85,247,0.15)',
  color: '#a78bfa',
  flexShrink: 0,
};

const spokeBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'var(--bg-hover)',
  color: 'var(--text-secondary)',
  flexShrink: 0,
};

const relatedStyle: React.CSSProperties = {
  display: 'block',
  padding: '10px 12px',
  borderRadius: 8,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  textDecoration: 'none',
  color: 'inherit',
};
