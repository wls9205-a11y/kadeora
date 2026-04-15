import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/admin/naver-image-test?secret=xxx
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
  const query = req.nextUrl.searchParams.get('q') || '아파트 단지 조감도';

  const results: Record<string, any> = {
    hasClientId: !!NAVER_CLIENT_ID,
    clientIdPrefix: NAVER_CLIENT_ID.slice(0, 4) + '...',
    hasClientSecret: !!NAVER_CLIENT_SECRET,
    query,
  };

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    results.error = 'NAVER API keys not set';
    return NextResponse.json(results);
  }

  // Test 1: Image Search API
  try {
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=5&sort=sim&filter=large`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
      signal: AbortSignal.timeout(10000),
    });

    results.imageApi = {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries([...res.headers.entries()].filter(([k]) =>
        k.includes('limit') || k.includes('remaining') || k.includes('rate') || k.includes('x-')
      )),
    };

    const body = await res.text();
    if (res.ok) {
      try {
        const json = JSON.parse(body);
        results.imageApi.total = json.total;
        results.imageApi.display = json.display;
        results.imageApi.itemCount = json.items?.length || 0;
        results.imageApi.firstItem = json.items?.[0] ? {
          title: json.items[0].title?.slice(0, 50),
          link: json.items[0].link?.slice(0, 80),
          sizewidth: json.items[0].sizewidth,
          sizeheight: json.items[0].sizeheight,
        } : null;
        // Size filter test
        const passed = (json.items || []).filter((item: any) => {
          const w = parseInt(item.sizewidth || '0');
          const h = parseInt(item.sizeheight || '0');
          return w >= 400 && h >= 250;
        });
        results.imageApi.passedSizeFilter = passed.length;
      } catch {
        results.imageApi.rawBody = body.slice(0, 500);
      }
    } else {
      results.imageApi.errorBody = body.slice(0, 500);
    }
  } catch (err: any) {
    results.imageApi = { fetchError: err.message };
  }

  // Test 2: Blog Search API (비교용)
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog?query=${encodeURIComponent(query)}&display=1`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    results.blogApi = {
      status: res.status,
      statusText: res.statusText,
    };
    if (res.ok) {
      const json = await res.json();
      results.blogApi.total = json.total;
    } else {
      const body = await res.text();
      results.blogApi.errorBody = body.slice(0, 300);
    }
  } catch (err: any) {
    results.blogApi = { fetchError: err.message };
  }

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
