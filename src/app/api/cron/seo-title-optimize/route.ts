import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TITLE_TEMPLATES: Record<string, (name: string, region?: string) => string> = {
  'stock-dividend': (name) => `${name} 배당금·배당일·배당수익률 총정리 (2026)`,
  'apt-trade': (name, region) => `${name} 실거래가 분석 — ${region || ''} 시세·평당가·거래 동향 (2026)`,
  'apt-price': (name, region) => `${region || ''} ${name} 아파트 실거래 총정리 (2026)`,
  'guide-compare': (name) => `${name} — 입지·시세·청약 비교 분석 (2026)`,
  'redev': (name, region) => `${name} 재건축 현황 — ${region || ''} 진행 단계·시공사·전망 (2026)`,
  'unsold': (name, region) => `${region || ''} ${name} 미분양 현황·세대수·분양가 (2026)`,
  'blog-etf': (name) => `${name} ETF 비교 분석 — 수익률·수수료·구성종목 (2026)`,
  'blog-sector': (name) => `${name} 섹터 분석 — 종목·실적·전망 (2026)`,
};

const DESC_TEMPLATES: Record<string, (name: string, region?: string) => string> = {
  'stock-dividend': (name) => `${name}의 2026년 배당금, 배당일, 배당수익률을 한눈에. 과거 배당 이력과 향후 전망까지 카더라에서 확인하세요.`,
  'apt-trade': (name, region) => `${name}(${region || ''})의 최신 실거래가, 평당가, 매매·전세 동향을 분석합니다. 카더라 부동산 데이터.`,
  'apt-price': (name, region) => `${region || ''} ${name} 가격대 아파트의 실거래 내역, 단지별 시세, 면적별 비교를 확인하세요.`,
  'guide-compare': (name) => `${name} 지역 아파트를 입지, 시세, 교통, 학군, 청약 관점에서 비교 분석합니다.`,
  'redev': (name, region) => `${region || ''} ${name}의 재건축·재개발 진행 단계, 시공사, 분담금 예상, 투자 전망을 정리합니다.`,
};

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('seo-title-optimize', async () => {
    const sb = getSupabaseAdmin();
    
    // view_count 낮고, 타이틀에 연도가 없는 포스트 우선
    const { data: posts } = await sb.from('blog_posts')
      .select('id, slug, title, meta_description, category, tags')
      .eq('is_published', true)
      .lt('view_count', 20)
      .order('published_at', { ascending: false })
      .limit(100);

    if (!posts?.length) return { processed: 0, metadata: { reason: 'no_targets' } };

    let updated = 0;
    for (const post of posts) {
      const slug = post.slug || '';
      let newTitle = post.title;
      let newDesc = post.meta_description;
      let matched = false;

      for (const [pattern, titleFn] of Object.entries(TITLE_TEMPLATES)) {
        if (slug.startsWith(pattern) || slug.includes(pattern)) {
          // slug에서 이름 추출
          const parts = slug.replace(pattern + '-', '').replace(/-2026$/, '').split('-');
          const name = parts.join(' ').replace(/\b\w/g, c => c);
          const region = (post.tags ?? []).find((t: string) => 
            ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'].includes(t)
          );
          
          // 이미 2026이 포함되어 있으면 스킵
          if (post.title.includes('2026')) break;
          
          newTitle = titleFn(post.title.split(' — ')[0].split(' | ')[0].trim(), region);
          const descFn = DESC_TEMPLATES[pattern];
          if (descFn && (!post.meta_description || post.meta_description.length < 80)) {
            newDesc = descFn(post.title.split(' — ')[0].trim(), region);
          }
          matched = true;
          break;
        }
      }

      // 타이틀에 연도 없으면 끝에 (2026) 추가
      if (!matched && !post.title.includes('2026') && !post.title.includes('202')) {
        newTitle = post.title.replace(/\s*\(?\d{4}\)?\s*$/, '') + ' (2026)';
        matched = true;
      }

      if (matched && newTitle !== post.title) {
        const updateData: Record<string, string> = { title: newTitle.slice(0, 100) };
        if (newDesc && newDesc !== post.meta_description) {
          updateData.meta_description = newDesc.slice(0, 160);
        }
        await sb.from('blog_posts').update(updateData).eq('id', post.id);
        updated++;
      }
    }

    return { processed: updated, metadata: { checked: posts.length } };
  });

  return NextResponse.json(result, { status: 200 });
}
