import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const TARGET_COUNT = 7;
const BATCH_LIMIT = 60;
const MAX_RUNTIME_MS = 250_000;

const DOMAIN_BLACKLIST = [
  /dcinside\./i, /namu\.wiki/i, /ppomppu\./i,
  /i\.pinimg\.com|ruliweb\.com/i, /\.gif(\?|$)/i,
];

function isBlacklisted(url: string): boolean {
  if (!url) return true;
  return DOMAIN_BLACKLIST.some((re) => re.test(url));
}

async function searchNaverImages(query: string, display = 10): Promise<{ url: string; thumb: string; title: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim&filter=large`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.items || [];
    return items
      .filter((i) => {
        const w = parseInt(i.sizewidth || '0');
        const h = parseInt(i.sizeheight || '0');
        if (w < 400 || h < 250) return false;
        if (isBlacklisted(i.link || '')) return false;
        return true;
      })
      .map((i) => ({
        url: (i.link || '').replace(/^http:\/\//, 'https://'),
        thumb: (i.thumbnail || i.link || '').replace(/^http:\/\//, 'https://'),
        title: (i.title || '').replace(/<[^>]+>/g, ''),
      }));
  } catch {
    return [];
  }
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('stock-image-crawl', async () => {
      const start = Date.now();
      const sb = getSupabaseAdmin();

      if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
        return { processed: 0, metadata: { error: 'NAVER API keys not set' } };
      }

      // 종목 이미지가 TARGET_COUNT 미만인 종목 우선 (시총 큰 순)
      const { data: symbolsNeeding } = await (sb as any).rpc(
        'get_stock_symbols_needing_images',
        { p_target: TARGET_COUNT, p_limit: BATCH_LIMIT },
      );

      let targets = symbolsNeeding as any[] | null;
      if (!Array.isArray(targets)) {
        // RPC 부재 시 fallback: 인기 종목 중 이미지 없는 것
        const { data: fb } = await sb
          .from('stock_quotes')
          .select('symbol, name, market')
          .eq('is_active', true)
          .gt('price', 0)
          .order('market_cap', { ascending: false, nullsFirst: false })
          .limit(BATCH_LIMIT);
        targets = fb || [];
      }

      if (!targets || targets.length === 0) {
        return { processed: 0, metadata: { message: '보충 대상 없음', elapsed_ms: Date.now() - start } };
      }

      let processed = 0;
      let created = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const t of targets) {
        if (Date.now() - start > MAX_RUNTIME_MS) {
          errors.push('timeout guard');
          break;
        }
        try {
          const symbol = t.symbol;
          const name = t.name || symbol;

          // 현재 수
          const { count } = await (sb as any)
            .from('stock_images')
            .select('id', { count: 'exact', head: true })
            .eq('symbol', symbol);
          const haveCount = count || 0;
          if (haveCount >= TARGET_COUNT) continue;

          const need = TARGET_COUNT - haveCount;
          const queries = [name, `${name} 주가`, `${name} 로고`].slice(0, 3);
          const collected: { url: string; thumb: string; title: string }[] = [];
          const seenUrls = new Set<string>();

          for (const q of queries) {
            if (collected.length >= need) break;
            const imgs = await searchNaverImages(q, need + 2);
            for (const img of imgs) {
              if (seenUrls.has(img.url)) continue;
              seenUrls.add(img.url);
              collected.push(img);
              if (collected.length >= need) break;
            }
          }

          processed++;
          if (collected.length === 0) {
            failed++;
            continue;
          }

          const rows = collected.map((img, idx) => ({
            symbol,
            image_url: img.url,
            alt_text: `${name}(${symbol}) 관련 이미지 ${haveCount + idx + 1}`,
            caption: img.title || null,
            source: 'naver-search',
            position: haveCount + idx,
          }));

          const { error: insertErr } = await (sb as any)
            .from('stock_images')
            .upsert(rows, { onConflict: 'symbol,image_url', ignoreDuplicates: true });
          if (insertErr) {
            failed++;
            errors.push(`${symbol}: ${insertErr.message}`);
          } else {
            created += rows.length;
          }
          await new Promise((r) => setTimeout(r, 120));
        } catch (e) {
          failed++;
          errors.push(`${t.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }

      return {
        processed,
        created,
        failed,
        metadata: {
          target: TARGET_COUNT,
          batch: BATCH_LIMIT,
          elapsed_ms: Date.now() - start,
          errors: errors.slice(0, 10),
        },
      };
    }),
  );
}

export const GET = withCronAuth(handler);
