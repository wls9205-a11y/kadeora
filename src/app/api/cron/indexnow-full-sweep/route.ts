export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { SITE_URL } from '@/lib/constants';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '3a23def313e1b1283822c54a0f9a5675';
const BATCH_SIZE = 5000; // IndexNow 최대 10,000이지만 안전하게

/**
 * IndexNow 풀 스위프 크론
 * 
 * 목적: 34,537개 단지 + 1,846개 종목 + 5,783개 현장 전체를
 * 순차적으로 IndexNow에 제출하여 구글/네이버/Bing 인덱싱 가속.
 * 
 * 동작:
 * - offset 파라미터로 페이지네이션 (0부터 시작)
 * - 매 실행 시 5,000개 URL 전송
 * - 전체 순회 후 offset=0으로 리셋
 * 
 * 수동 실행: /api/cron/indexnow-full-sweep?offset=0&type=complex
 * type: stock | complex | site | all (기본: all — 순서대로 처리)
 */
async function handler(req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('indexnow-full-sweep', async () => {
      const sb = getSupabaseAdmin();
      const url = new URL(req.url);
      const type = url.searchParams.get('type') || 'all';
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const urls: string[] = [];
      let totalAvailable = 0;
      let nextOffset = 0;
      let currentType = type;

      if (type === 'all' || type === 'stock') {
        // 전체 주식 종목 (1,846개 — 한 번에 처리 가능)
        const { data: stocks } = await sb.from('stock_quotes')
          .select('symbol')
          .gt('price', 0)
          .order('symbol', { ascending: true });
        if (stocks?.length) {
          urls.push(...stocks.map((s: any) => `${SITE_URL}/stock/${s.symbol}`));
          totalAvailable += stocks.length;
        }
        if (type === 'stock') {
          nextOffset = 0; // 종목은 한 번에 끝남
          currentType = 'stock';
        }
      }

      if (type === 'all' || type === 'complex') {
        // 단지백과 페이지네이션 (34,537개)
        const { data: complexes, count } = await (sb as any).from('apt_complex_profiles')
          .select('apt_name', { count: 'exact' })
          .not('apt_name', 'is', null)
          .order('apt_name', { ascending: true })
          .range(offset, offset + BATCH_SIZE - 1);
        
        if (complexes?.length) {
          urls.push(...complexes.map((c: any) => `${SITE_URL}/apt/complex/${encodeURIComponent(c.apt_name)}`));
          totalAvailable = count || 0;
          nextOffset = offset + complexes.length;
          if (nextOffset >= totalAvailable) nextOffset = 0; // 순회 완료 시 리셋
          currentType = 'complex';
        }
      }

      if (type === 'all' || type === 'site') {
        // 청약/분양 현장 (5,783개)
        const { data: sites } = await sb.from('apt_sites')
          .select('slug')
          .eq('is_active', true)
          .not('slug', 'is', null)
          .order('slug', { ascending: true })
          .range(type === 'site' ? offset : 0, type === 'site' ? offset + BATCH_SIZE - 1 : BATCH_SIZE - 1);
        if (sites?.length) {
          urls.push(...sites.map((s: any) => `${SITE_URL}/apt/${s.slug}`));
        }
      }

      // 지역 허브 (17개 시도)
      if (type === 'all') {
        const regions = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];
        urls.push(...regions.map(r => `${SITE_URL}/apt/region/${encodeURIComponent(r)}`));
      }

      if (!urls.length) {
        return { processed: 0, metadata: { message: '전송할 URL 없음' } };
      }

      // IndexNow 전송 — 5,000개씩 배치
      const endpoints = [
        'https://api.indexnow.org/indexnow',
        'https://searchadvisor.naver.com/indexnow',
        'https://www.bing.com/indexnow',
      ];

      let sentCount = 0;
      const endpointResults: any[] = [];

      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const payload = {
          host: 'kadeora.app',
          key: INDEXNOW_KEY,
          keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
          urlList: batch,
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

        endpointResults.push(...results.map(r =>
          r.status === 'fulfilled' ? r.value : { error: 'failed' }
        ));
        sentCount += batch.length;

        // 배치 간 500ms 딜레이
        if (i + BATCH_SIZE < urls.length) await new Promise(r => setTimeout(r, 500));
      }

      return {
        processed: sentCount,
        metadata: {
          type: currentType,
          offset,
          nextOffset,
          totalAvailable,
          urlCount: urls.length,
          endpoints: endpointResults.slice(0, 6), // 처음 2배치만 로그
        },
      };
    })
  );
}

export const GET = withCronAuth(handler);
