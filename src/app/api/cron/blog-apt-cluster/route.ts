import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TEMPLATES = [
  { sfx: '청약 전략 완전정복', slug: 'strategy', kw: '청약 전략 가점' },
  { sfx: '분양가 분석 주변 시세 비교', slug: 'price', kw: '분양가 평당가 시세' },
  { sfx: '입주비용 총정리', slug: 'move-in', kw: '입주비용 취득세 계산' },
];

function toSlug(name: string, sfx: string): string {
  return `${name}-${sfx}-2026`.replace(/[^가-힣a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().slice(0, 80);
}

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-apt-cluster', async () => {
    const admin = getSupabaseAdmin();

    const { data: sites } = await (admin as any).from('apt_sites')
      .select('id, slug, name, region, sigungu, builder, total_units, price_min, price_max, nearby_station, school_district, move_in_date')
      .eq('is_active', true)
      .or('cluster_blog_ids.is.null,cluster_blog_ids.eq.[]')
      .not('analysis_text', 'is', null)
      .order('page_views', { ascending: false, nullsFirst: false })
      .limit(2);

    if (!sites || sites.length === 0) return { processed: 0, metadata: { reason: 'no_candidates' } };

    let created = 0;
    for (const site of sites) {
      const ids: number[] = [];
      for (const t of TEMPLATES) {
        try {
          const title = `${site.name} ${t.sfx} 2026`;
          const slug = toSlug(site.name, t.slug);

          // 중복 체크
          const { data: dup } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
          if (dup) continue;

          const pMin = site.price_min ? `${(site.price_min/10000).toFixed(1)}억` : '';
          const pMax = site.price_max ? `${(site.price_max/10000).toFixed(1)}억` : '';

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000,
              messages: [{ role: 'user', content: `"${title}" 블로그 2500자+.\n${site.name}, ${site.region} ${site.sigungu||''}, 시공=${site.builder||''}, ${site.total_units||'?'}세대, 분양가=${pMin||pMax||'미공개'}, 역=${site.nearby_station||'-'}, 학군=${site.school_district||'-'}, 입주=${site.move_in_date||'미정'}\n## 4~6개, 내부링크: [상세→](/apt/${site.slug}) [진단→](/apt/diagnose) [계산→](/calc) [블로그→](/blog). FAQ ### Q. 3개. 마크다운,목차금지,##볼드금지,면책.` }],
            }),
          });
          if (!res.ok) continue;
          const content = (await res.json()).content?.[0]?.text;
          if (!content || content.length < 1500) continue;

          const r = await safeBlogInsert(admin as any, {
            slug, title, content, category: 'apt',
            tags: [site.name, site.region, t.kw, site.builder].filter(Boolean),
            source_type: 'apt-cluster', source_ref: site.slug,
          });
          if (r.success && r.id) { ids.push(r.id); created++; }
        } catch { /* skip */ }
      }
      if (ids.length > 0) {
        await (admin as any).from('apt_sites').update({ cluster_blog_ids: ids }).eq('id', site.id);
      }
    }
    return { processed: sites.length, created, metadata: { templates: TEMPLATES.length } };
  });
  return NextResponse.json(result);
}
