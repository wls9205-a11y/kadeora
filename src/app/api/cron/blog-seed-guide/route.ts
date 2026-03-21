import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';


export const dynamic = 'force-dynamic';

const CATEGORY_MAP: Record<string, string> = {
  'region-guide': 'apt',
  'realestate-basic': 'apt',
  'stock-basic': 'stock',
  'finance-basic': 'finance',
  'life-tip': 'finance',
};

function generateGuideContent(seed: any): string {
  const title = seed.title || '가이드';
  const outline = (seed.outline || '').split('|').map((s: string) => s.trim()).filter(Boolean);
  const category = seed.seed_category || '';

  let content = `${seed.intro || `이 글에서는 ${title}에 대해 자세히 알아보겠습니다. 초보자도 쉽게 이해할 수 있도록 핵심 내용을 정리했습니다.`}\n\n`;

  for (const section of outline) {
    content += `## ${section}\n\n`;
    content += generateSectionContent(section, category) + '\n\n';
  }

  content += `## 자주 묻는 질문 (FAQ)\n\n`;
  const faqs = generateFaqs(title, category);
  for (const faq of faqs) {
    content += `### ${faq.q}\n${faq.a}\n\n`;
  }

  content += `---\n\n> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 투자 권유가 아닙니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.`;
  return content;
}

function generateSectionContent(section: string, category: string): string {
  if (section.includes('청약')) return '청약은 무주택 세대 구성원이라면 누구나 도전할 수 있습니다. 가점제와 추첨제의 차이를 이해하고, 본인의 상황에 맞는 전략을 세우는 것이 중요합니다. 청약통장 가입 기간, 부양가족 수, 무주택 기간이 가점의 핵심 요소입니다.';
  if (section.includes('전세')) return '전세 계약 시에는 등기부등본 확인, 전세보증보험 가입, 집주인 신원 확인이 필수입니다. 전세가율이 70%를 넘으면 역전세 위험이 있으므로 주의가 필요합니다.';
  if (section.includes('주식')) return '주식 투자의 기본은 분산 투자입니다. 한 종목에 집중하기보다 업종과 시가총액을 고려한 포트폴리오 구성이 안정적입니다. ETF를 활용하면 초보자도 쉽게 분산 투자할 수 있습니다.';
  if (section.includes('세금')) return '세금 절약의 핵심은 공제 항목을 빠짐없이 활용하는 것입니다. 연금저축, IRP, 주택청약 등 세액공제 항목을 최대한 활용하면 연간 수십만 원을 절약할 수 있습니다.';
  if (category.includes('stock')) return `${section}은(는) 투자에서 중요한 개념입니다. 기본적인 원리를 이해하고 실제 사례를 통해 학습하면 더 나은 투자 판단을 할 수 있습니다. 시장의 변동성에 일희일비하지 않고 장기적 관점에서 접근하는 것이 핵심입니다.`;
  if (category.includes('real') || category.includes('apt') || category.includes('region')) return `${section}에 대해 꼼꼼히 살펴보겠습니다. 부동산은 지역별 특성이 크므로, 해당 지역의 개발 계획, 인구 유입 추이, 교통 인프라 등을 종합적으로 분석하는 것이 중요합니다.`;
  return `${section}에 대해 알아보겠습니다. 핵심 포인트를 중심으로 실용적인 정보를 정리했으니, 본인의 상황에 맞게 활용해 보시기 바랍니다. 더 자세한 내용은 관련 전문가 상담을 권합니다.`;
}

function generateFaqs(title: string, category: string) {
  if (category.includes('stock')) {
    return [
      { q: '주식 초보자는 어떻게 시작해야 하나요?', a: '소액부터 시작하고 ETF로 분산 투자하는 것을 추천합니다. 모의투자로 연습한 후 실전에 임하면 좋습니다.' },
      { q: '어떤 증권사를 선택해야 하나요?', a: '수수료, 앱 편의성, 리서치 자료 등을 비교해보세요. 대부분의 증권사가 비대면 계좌 개설을 지원합니다.' },
      { q: '투자 시 가장 중요한 것은?', a: '분산 투자와 장기적 관점이 가장 중요합니다. 감정에 휘둘리지 않는 원칙 있는 투자를 하세요.' },
    ];
  }
  return [
    { q: `${title}에서 가장 중요한 포인트는?`, a: '핵심은 기본 원리를 이해하고 본인 상황에 맞게 적용하는 것입니다. 무리한 결정보다 충분한 정보 수집이 우선입니다.' },
    { q: '초보자도 따라할 수 있나요?', a: '네, 이 가이드는 초보자 눈높이에 맞춰 작성되었습니다. 단계별로 천천히 따라하시면 됩니다.' },
    { q: '추가로 공부할 자료가 있나요?', a: '카더라 블로그에서 관련 글을 더 찾아보시거나, 금융감독원·한국부동산원 등 공신력 있는 기관의 자료를 참고하세요.' },
  ];
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: seeds, error: fetchErr } = await admin
      .from('guide_seeds')
      .select('*')
      .eq('blog_generated', false);

    if (fetchErr) { console.error('[blog-seed-guide] fetch error:', fetchErr); return NextResponse.json({ error: fetchErr.message }, { status: 500 }); }
    if (!seeds || seeds.length === 0) return NextResponse.json({ ok: true, created: 0, message: 'No pending guide seeds' });

    console.log(`[blog-seed-guide] Found ${seeds.length} seeds, columns:`, Object.keys(seeds[0] || {}));

    let created = 0;
    let skipped = 0;
    for (const seed of seeds) {
      try {
        const slug = seed.blog_slug || seed.slug;
        if (!slug) { skipped++; continue; }

        const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
        if (exists) {
          // Update using whichever column exists
          if (seed.blog_slug) await admin.from('guide_seeds').update({ blog_generated: true }).eq('blog_slug', slug);
          else await admin.from('guide_seeds').update({ blog_generated: true }).eq('slug', slug);
          continue;
        }

        const cat = CATEGORY_MAP[seed.seed_category] || 'finance';
        const content = generateGuideContent(seed);
        const tags = seed.tags || [seed.seed_category].filter(Boolean);

        await admin.from('blog_posts').insert({
          slug,
          title: seed.title,
          content: ensureMinLength(content, cat),
          excerpt: seed.meta_description || `${seed.title} 완전 정리 2026`,
          category: cat,
          tags,
          cron_type: 'seed-guide',
          cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(seed.title)}&type=blog`,
          image_alt: generateImageAlt(cat, seed.title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords(cat, tags),
        });

        if (seed.blog_slug) await admin.from('guide_seeds').update({ blog_generated: true }).eq('blog_slug', slug);
        else await admin.from('guide_seeds').update({ blog_generated: true }).eq('slug', slug);
        created++;
      } catch (e: any) {
        console.error(`[blog-seed-guide] Error for ${seed.blog_slug || seed.slug}:`, e.message);
      }
    }

    console.log(`[blog-seed-guide] Created ${created}/${seeds.length}, skipped ${skipped}`);
    return NextResponse.json({ ok: true, created, total: seeds.length, skipped });
  } catch (error: any) {
    console.error('[blog-seed-guide] Error:', error);
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
