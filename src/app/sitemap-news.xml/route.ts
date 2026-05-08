/**
 * s261: sitemap-news.xml → news-sitemap.xml 301 redirect.
 * 두 경로 모두 외부에 노출돼 있어 Google이 양쪽 모두 색인 → 중복 사이트맵 신호 약화.
 * /news-sitemap.xml 을 canonical 로 통일.
 */

import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.redirect(`${SITE_URL}/news-sitemap.xml`, 301);
}
