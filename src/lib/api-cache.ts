import { NextResponse } from 'next/server';

/** Cached JSON response with Vercel Edge Cache */
export function cachedJson(data: unknown, ttl = 60) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 5}`,
    },
  });
}
