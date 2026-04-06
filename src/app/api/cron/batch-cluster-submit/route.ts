import { AI_MODEL_SONNET, ANTHROPIC_VERSION } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CLUSTER_TEMPLATES = {
  apt: [
    { sfx: 'subscription-strategy', title: (n: string) => `${n} 청약 전략 완전정복`, kw: '청약 전략 가점 당첨' },
    { sfx: 'price-analysis', title: (n: string) => `${n} 분양가 분석 주변 시세 비교`, kw: '분양가 평당가 시세 비교' },
    { sfx: 'move-in-cost', title: (n: string) => `${n} 입주비용 총정리`, kw: '입주비용 취득세 중개수수료' },
  ],
  stock: [
    { sfx: 'investment-strategy', title: (n: string, s: string) => `${n}(${s}) 투자 전략 완전분석`, kw: '투자 전략 매수 매도 타이밍' },
    { sfx: 'dividend-analysis', title: (n: string, s: string) => `${n}(${s}) 배당금 분석 — 수익률 계산`, kw: '배당금 수익률 배당일 배당락' },
    { sfx: 'earnings-outlook', title: (n: string, s: string) => `${n}(${s}) 실적 전망 — 목표가 분석`, kw: '실적 전망 목표가 EPS 어닝' },
  ],
};

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('batch-cluster-submit', async () => {
    const admin = getSupabaseAdmin();
    const API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!API_KEY) return { processed: 0, metadata: { error: 'no_api_key' } };

    // 진행 중인 배치 있으면 스킵
    const { data: active } = await (admin as any).from('rewrite_batches')
      .select('id').in('status', ['submitted', 'processing'])
      .eq('category', 'cluster-blog').limit(1);
    if (active?.length) return { processed: 0, metadata: { reason: 'batch_in_progress' } };

    const requests: any[] = [];

    // 부동산 클러스터 대상: 분석 있고 클러스터 없는 현장
    const { data: aptSites } = await (admin as any).from('apt_sites')
      .select('slug, name, region, sigungu, builder, total_units, price_min, price_max, nearby_station, school_district, move_in_date')
      .eq('is_active', true)
      .not('analysis_text', 'is', null)
      .order('page_views', { ascending: false, nullsFirst: false })
      .limit(50);

    for (const site of (aptSites || [])) {
      // 이미 클러스터 있는지 확인
      const { count } = await admin.from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('source_type', 'apt-cluster').eq('source_ref', site.slug);
      if ((count || 0) >= 3) continue;

      for (const t of CLUSTER_TEMPLATES.apt) {
        const slug = `${site.slug}-${t.sfx}`.slice(0, 80);
        const { data: dup } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
        if (dup) continue;

        const title = t.title(site.name);
        const pMin = site.price_min ? `${(site.price_min/10000).toFixed(1)}억` : '';
        const pMax = site.price_max ? `${(site.price_max/10000).toFixed(1)}억` : '';

        requests.push({
          custom_id: `apt-cluster:${slug}`,
          params: {
            model: AI_MODEL_SONNET,
            max_tokens: 3000,
            messages: [{ role: 'user', content: `"${title}" 블로그 2500자+.\n${site.name}, ${site.region} ${site.sigungu||''}, 시공=${site.builder||''}, ${site.total_units||'?'}세대, 분양가=${pMin||pMax||'미공개'}, 역=${site.nearby_station||'-'}, 학군=${site.school_district||'-'}, 입주=${site.move_in_date||'미정'}\n키워드: ${t.kw}\n## 4~6개 소제목. 내부링크: [상세→](/apt/${site.slug}) [계산→](/calc) [진단→](/apt/diagnose). FAQ ### Q. 3개. 마크다운,목차금지,##안에볼드금지,면책문구 마지막.` }],
          },
        });
      }
    }

    // 주식 클러스터 대상
    const { data: stocks } = await (admin as any).from('stock_quotes')
      .select('symbol, name, market, price, change_pct, sector, per, pbr, dividend_yield, market_cap')
      .eq('is_active', true)
      .not('analysis_text', 'is', null)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(30);

    for (const s of (stocks || [])) {
      const { count } = await admin.from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('source_type', 'stock-cluster').eq('source_ref', s.symbol);
      if ((count || 0) >= 3) continue;

      for (const t of CLUSTER_TEMPLATES.stock) {
        const slug = `${s.symbol.toLowerCase()}-${t.sfx}`.slice(0, 80);
        const { data: dup } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
        if (dup) continue;

        const title = t.title(s.name, s.symbol);
        const p = s.market === 'KOSPI' || s.market === 'KOSDAQ' ? `${Number(s.price).toLocaleString()}원` : `$${Number(s.price).toFixed(2)}`;

        requests.push({
          custom_id: `stock-cluster:${slug}`,
          params: {
            model: AI_MODEL_SONNET,
            max_tokens: 3000,
            messages: [{ role: 'user', content: `"${title}" 블로그 2000자+.\n${s.name}(${s.symbol}), ${s.market}, 현재가=${p}, 시총=${s.market_cap?(Number(s.market_cap)/1e8).toFixed(0)+'억':'-'}, 섹터=${s.sector||'-'}, PER=${s.per||'-'}, PBR=${s.pbr||'-'}, 배당=${s.dividend_yield||'-'}%\n키워드: ${t.kw}\n## 4~6개 소제목. 내부링크: [시세→](/stock/${s.symbol}) [블로그→](/blog). FAQ ### Q. 3개. 마크다운,목차금지,##볼드금지,면책.` }],
          },
        });
      }
    }

    if (requests.length === 0) return { processed: 0, metadata: { reason: 'no_targets' } };

    // Batch API 제출
    const jsonl = requests.map(r => JSON.stringify(r)).join('\n');
    const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST', headers: { 'x-api-key': API_KEY, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ requests: requests.map(r => ({ custom_id: r.custom_id, params: r.params })) }),
    });
    const batchData = await batchRes.json();

    if (batchData.id) {
      await (admin as any).from('rewrite_batches').insert({
        batch_id: batchData.id, category: 'cluster-blog', status: 'submitted',
        total_requests: requests.length, metadata: { apt: aptSites?.length || 0, stock: stocks?.length || 0 },
      });
    }

    return { processed: requests.length, metadata: { batch_id: batchData.id, apt_sites: aptSites?.length, stocks: stocks?.length } };
  });
  return NextResponse.json(result);
}
