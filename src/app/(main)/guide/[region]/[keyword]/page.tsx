/**
 * 세션 146 E3 — Programmatic SEO 템플릿: /guide/{region}/{keyword}.
 *
 * 예: /guide/서울/청약일정, /guide/부산/재개발, /guide/분당/실거래
 *
 * SSR 본문 + JSON-LD (BlogPosting + FAQPage + Breadcrumb) 자동 삽입.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import BlogPostingSchema from '@/components/seo/schemas/BlogPosting';
import FAQPageSchema from '@/components/seo/schemas/FAQPage';
import BreadcrumbListSchema from '@/components/seo/schemas/BreadcrumbList';

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

const ALLOWED_KEYWORDS = new Set([
  '청약일정', '청약', '실거래', '시세', '재개발', '재건축', '미분양', '분양', '전세', '매매',
]);

interface Params { region: string; keyword: string; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { region, keyword } = await params;
  const r = decodeURIComponent(region);
  const k = decodeURIComponent(keyword);
  const year = new Date().getFullYear();
  const title = `${r} ${k} 완전 정리 (${year})`;
  const description = `${r} 지역 ${k} 최신 정보 ${year}년 기준. 청약일정·실거래가·시세·분양 공고를 카더라가 매일 정리합니다.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/guide/${encodeURIComponent(r)}/${encodeURIComponent(k)}` },
    openGraph: { title, description, type: 'article', locale: 'ko_KR', url: `${SITE}/guide/${encodeURIComponent(r)}/${encodeURIComponent(k)}` },
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { region: regionParam, keyword: keywordParam } = await params;
  const region = decodeURIComponent(regionParam);
  const keyword = decodeURIComponent(keywordParam);
  if (!ALLOWED_KEYWORDS.has(keyword)) notFound();

  const sb = getSupabaseAdmin();
  const { data: queue } = await (sb as any)
    .from('programmatic_seo_queue')
    .select('id, params, status')
    .eq('slug', `guide-${region}-${keyword}`)
    .maybeSingle();

  const year = new Date().getFullYear();
  const title = `${region} ${keyword} 완전 정리 (${year})`;
  const faqs = [
    { q: `${region} ${keyword} 최신 정보는 어디서 확인하나요?`, a: `카더라 ${region} 페이지에서 실시간 업데이트를 확인하세요.` },
    { q: `${region} ${keyword} 변동 알림을 받을 수 있나요?`, a: `회원 가입 후 관심 지역/키워드 설정 시 알림을 받을 수 있습니다.` },
    { q: `${region} ${keyword} 이력은 어디까지 조회 가능한가요?`, a: `최근 12개월 데이터는 무료로 조회 가능하며, 프리미엄 회원은 전체 이력 접근이 가능합니다.` },
  ];

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
      <BreadcrumbListSchema items={[
        { name: '홈', url: SITE },
        { name: '가이드', url: `${SITE}/guide` },
        { name: region, url: `${SITE}/guide/${encodeURIComponent(region)}` },
        { name: keyword, url: `${SITE}/guide/${encodeURIComponent(region)}/${encodeURIComponent(keyword)}` },
      ]} />
      <BlogPostingSchema
        slug={`guide-${region}-${keyword}`}
        title={title}
        description={`${region} 지역 ${keyword} 최신 정보 ${year}년 기준 종합 가이드.`}
        images={[`${SITE}/api/og?title=${encodeURIComponent(title)}&category=apt&design=3`]}
        datePublished={new Date().toISOString()}
        category="apt"
      />
      <FAQPageSchema faqs={faqs} />

      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>{title}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        {region} 지역의 {keyword} 관련 최신 소식을 한눈에 정리했습니다. 매일 자동 업데이트.
      </p>
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>핵심 요약</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>{region} {keyword} 관련 주요 이슈 및 동향</li>
          <li>최근 분양/거래 사례 및 가격 범위</li>
          <li>투자 포인트 및 주의사항</li>
        </ul>
      </section>
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>자주 묻는 질문</h2>
        <dl>
          {faqs.map((f, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <dt style={{ fontWeight: 700 }}>Q. {f.q}</dt>
              <dd style={{ marginLeft: 0, color: 'var(--text-secondary)' }}>A. {f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      {queue?.id && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 32 }}>
          programmatic_seo_queue#{queue.id} · status={queue.status}
        </p>
      )}
    </div>
  );
}
