export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * 인기 검색어 자동 갱신 크론
 * 매 6시간 실행 — 블로그 인기 태그 + 주식 인기 종목 + 검색 로그 기반 갱신
 */
async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('refresh-trending', async () => {
      const sb = getSupabaseAdmin();

      // 1. 기존 RPC 실행 (게시글 기반 heat_score 갱신)
      await sb.rpc('refresh_trending_keywords').then(() => {});

      // 2. 인기 블로그 태그 수집 (최근 7일)
      let blogTags: string[] = [];
      try {
        const { data: tagData } = await sb.rpc('blog_popular_tags', { limit_count: 10 });
        blogTags = (tagData || []).map((t: any) => t.tag).filter(Boolean);
      } catch { /* silent */ }

      // 3. 인기 주식 종목 (등락률 상위)
      const { data: stockData } = await sb
        .from('stock_quotes')
        .select('name')
        .gt('price', 0)
        .order('change_pct', { ascending: false })
        .limit(5);
      const stockNames: string[] = (stockData || []).map((s: any) => s.name).filter(Boolean);

      // 4. 검색 로그 기반 (최근 7일)
      let searchTerms: string[] = [];
      try {
        const { data: searchData } = await sb.rpc('get_trending_searches');
        searchTerms = (searchData || []).map((s: any) => s.keyword).filter(Boolean);
      } catch { /* silent */ }

      // 5. 후보 키워드 합치기 (검색로그 > 블로그태그 > 주식 순 우선)
      const allCandidates = [...new Set([...searchTerms, ...blogTags, ...stockNames])];

      // 6. 기존 키워드 조회
      const { data: existing } = await sb.from('trending_keywords').select('keyword');
      const existingSet = new Set((existing || []).map((e: any) => e.keyword));

      // 7. 새 키워드 추가 (기존에 없는 것만, 최대 5개)
      const newKeywords = allCandidates.filter(k => !existingSet.has(k)).slice(0, 5);
      let added = 0;
      for (const keyword of newKeywords) {
        const category = blogTags.includes(keyword) ? 'blog' : stockNames.includes(keyword) ? 'stock' : 'search';
        await sb.from('trending_keywords').upsert({
          keyword,
          heat_score: 100,
          category,
          rank: 99,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'keyword' });
        added++;
      }

      // 8. 오래된 키워드 정리 (heat_score 50 이하 + 20개 초과 시 하위 삭제)
      const { data: allKw } = await sb.from('trending_keywords')
        .select('id, keyword, heat_score')
        .order('heat_score', { ascending: true });
      if (allKw && allKw.length > 15) {
        const toDelete = allKw.slice(0, allKw.length - 15).filter((k: any) => k.heat_score < 50);
        if (toDelete.length > 0) {
          await sb.from('trending_keywords').delete().in('id', toDelete.map((k: any) => k.id));
        }
      }

      // 9. rank 재계산
      await sb.rpc('refresh_trending_keywords');

      return {
        processed: added,
        metadata: {
          blogTags: blogTags.length,
          stockNames: stockNames.length,
          searchTerms: searchTerms.length,
          newAdded: added,
          totalKeywords: (existing?.length || 0) + added,
        },
      };
    })
  );
}

export const GET = withCronAuth(handler);
