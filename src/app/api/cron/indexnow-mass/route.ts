export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { SITE_URL } from '@/lib/constants';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '3a23def313e1b1283822c54a0f9a5675';
const BATCH_SIZE = 500; // IndexNow는 10,000개까지 지원하지만 안전하게

/**
 * IndexNow 대량 전송 크론
 * 
 * 목적: 7,600편+ 블로그 중 아직 IndexNow에 전송되지 않은 URL을 순차적으로 전송.
 * indexed_at이 null인 블로그를 오래된 순으로 500개씩 전송하고 indexed_at 업데이트.
 * 
 * 매 6시간 실행 → 하루 2,000편 → 10일이면 전체 커버
 */
async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('indexnow-mass', async () => {
      const sb = getSupabaseAdmin();

      // 1) indexed_at이 null이거나 30일 이상 지난 블로그 URL 수집
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: blogs, error } = await sb
        .from('blog_posts')
        .select('id, slug')
        .eq('is_published', true)
        .not('published_at', 'is', null)
        .or(`indexed_at.is.null,indexed_at.lt.${thirtyDaysAgo}`)
        .order('published_at', { ascending: true }) // 오래된 것부터
        .limit(BATCH_SIZE);

      if (error || !blogs?.length) {
        return { processed: 0, metadata: { error: error?.message, message: '전송할 URL 없음' } };
      }

      // 2) URL 목록 구성
      const blogUrls = blogs.map(b => `${SITE_URL}/blog/${b.slug}`);

      // 3) 정적 주요 페이지도 함께 (매번 리프레시)
      const staticUrls = [
        `${SITE_URL}`,
        `${SITE_URL}/blog`,
        `${SITE_URL}/stock`,
        `${SITE_URL}/apt`,
        `${SITE_URL}/feed`,
        `${SITE_URL}/discuss`,
      ];

      // 3-b) 주식 종목 + 섹터 URL (최근 업데이트 100개)
      let stockUrls: string[] = [];
      try {
        const { data: recentStocks } = await sb.from('stock_quotes')
          .select('symbol')
          .eq('is_active', true)
          .gt('price', 0)
          .order('updated_at', { ascending: false })
          .limit(100);
        if (recentStocks?.length) {
          stockUrls = recentStocks.map((s: any) => `${SITE_URL}/stock/${s.symbol}`);
        }
        // 섹터 페이지
        const { data: sectors } = await sb.from('stock_quotes')
          .select('sector')
          .not('sector', 'is', null)
          .neq('sector', '')
          .gt('price', 0);
        if (sectors?.length) {
          const uniqueSectors = [...new Set(sectors.map((s: any) => s.sector))];
          stockUrls.push(...uniqueSectors.map(s => `${SITE_URL}/stock/sector/${encodeURIComponent(s)}`));
        }
      } catch {}

      // apt analysis pages
      let aptUrls: string[] = [];
      try {
        const { data: recentApts } = await sb.from('apt_sites')
          .select('slug')
          .eq('is_active', true)
          .not('analysis_text', 'is', null)
          .order('analysis_generated_at', { ascending: false })
          .limit(50);
        if (recentApts) aptUrls = recentApts.map((a: any) => `${SITE_URL}/apt/${a.slug}`);
      } catch {}

      // 프로그래매틱 SEO 페이지 — 시군구/동 허브, 테마, 건설사
      let seoUrls: string[] = [];
      try {
        // 시군구 허브 (최근 거래 활발한 시군구 50개)
        const { data: sgData } = await (sb as any).from('apt_complex_profiles')
          .select('region_nm, sigungu')
          .not('age_group', 'is', null).not('sigungu', 'is', null)
          .gt('sale_count_1y', 0)
          .order('sale_count_1y', { ascending: false }).limit(500);
        const sgSet = new Set<string>();
        for (const r of (sgData || [])) {
          const key = `${r.region_nm}/${r.sigungu}`;
          if (!sgSet.has(key) && sgSet.size < 50) { sgSet.add(key); seoUrls.push(`${SITE_URL}/apt/area/${encodeURIComponent(r.region_nm)}/${encodeURIComponent(r.sigungu)}`); }
        }
        // 테마 페이지 (6종 × 전국)
        for (const t of ['low-jeonse-ratio', 'high-jeonse-ratio', 'price-up', 'price-down', 'new-built', 'high-trade']) {
          seoUrls.push(`${SITE_URL}/apt/theme/${t}`);
        }
        // 건설사 상위 20
        const { data: bd } = await sb.from('apt_sites').select('builder').eq('is_active', true).not('builder', 'is', null).neq('builder', '');
        const bMap = new Map<string, number>();
        for (const r of (bd || [])) { if (r.builder) bMap.set(r.builder, (bMap.get(r.builder) || 0) + 1); }
        const topBuilders = Array.from(bMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [b] of topBuilders) { seoUrls.push(`${SITE_URL}/apt/builder/${encodeURIComponent(b)}`); }
        // 단지백과 (최근 거래 활발한 100개)
        const { data: cpData } = await (sb as any).from('apt_complex_profiles')
          .select('apt_name').not('age_group', 'is', null).gt('sale_count_1y', 5)
          .order('sale_count_1y', { ascending: false }).limit(100);
        for (const p of (cpData || [])) { seoUrls.push(`${SITE_URL}/apt/complex/${encodeURIComponent(p.apt_name)}`); }
      } catch {}

      // ━━━ 신규 SEO 페이지 (세션 114 확장) ━━━
      // 용어사전 / 주식 차트·재무 / 데일리 리포트 히스토리
      let newSeoUrls: string[] = [];
      try {
        // 용어사전 (41개)
        const { data: glossary } = await (sb as any).from('stock_glossary')
          .select('slug').not('slug', 'is', null).neq('slug', '');
        for (const g of (glossary || [])) {
          newSeoUrls.push(`${SITE_URL}/glossary/${encodeURIComponent(g.slug)}`);
        }
        newSeoUrls.push(`${SITE_URL}/glossary`);

        // 종목 차트·재무 페이지 (상위 100 종목 — 거래량 순)
        const { data: topStocks } = await sb.from('stock_quotes')
          .select('symbol').eq('is_active', true).gt('price', 0)
          .order('volume', { ascending: false, nullsFirst: false }).limit(100);
        for (const s of (topStocks || [])) {
          newSeoUrls.push(`${SITE_URL}/stock/${s.symbol}/chart`);
          newSeoUrls.push(`${SITE_URL}/stock/${s.symbol}/financials`);
        }

        // 데일리 리포트 최근 7일 (17개 지역 × 7일 = 최대 119개)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { data: daily } = await sb.from('daily_reports')
          .select('region, report_date')
          .gte('report_date', sevenDaysAgo)
          .not('region', 'is', null);
        for (const d of (daily || [])) {
          const dateStr = typeof d.report_date === 'string' ? d.report_date.slice(0, 10) : new Date(d.report_date).toISOString().slice(0, 10);
          newSeoUrls.push(`${SITE_URL}/daily/${encodeURIComponent(d.region)}/${dateStr}`);
        }

        // 신규 정적 페이지 (세션 114 추가)
        newSeoUrls.push(`${SITE_URL}/stock/short-selling`, `${SITE_URL}/stock/signals`, `${SITE_URL}/premium`);
      } catch {}

      const allUrls = [...staticUrls, ...stockUrls, ...blogUrls, ...aptUrls, ...seoUrls, ...newSeoUrls];

      // 4) IndexNow 전송 (3개 엔드포인트 동시)
      const endpoints = [
        'https://api.indexnow.org/indexnow',
        'https://searchadvisor.naver.com/indexnow',
        'https://www.bing.com/indexnow',
      ];

      const payload = {
        host: 'kadeora.app',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: allUrls,
      };

      const results = await Promise.allSettled(
        endpoints.map(async ep => {
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload),
          });
          return { endpoint: ep, status: res.status, ok: res.ok };
        })
      );

      // 5) indexed_at 업데이트 (전송 성공 여부와 무관하게 — 재시도는 30일 후)
      const now = new Date().toISOString();
      const ids = blogs.map(b => b.id);

      // 500개씩 배치 업데이트 (Supabase 제한 대응)
      // indexed_at은 마이그레이션 후 추가되는 컬럼이라 타입 캐스트 필요
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        await sb
          .from('blog_posts')
          .update({ indexed_at: now } as Record<string, unknown>)
          .in('id', batch);
      }

      const endpointResults = results.map(r => 
        r.status === 'fulfilled' ? r.value : { error: 'failed' }
      );

      return {
        processed: blogs.length,
        metadata: {
          totalUrls: allUrls.length,
          blogUrls: blogUrls.length,
          seoUrls: seoUrls.length,
          newSeoUrls: newSeoUrls.length,
          endpoints: endpointResults,
        },
      };
    })
  );
}

export const GET = withCronAuth(handler);
