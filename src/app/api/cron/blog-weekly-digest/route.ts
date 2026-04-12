export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { SITE_URL } from '@/lib/constants';
import { withCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

function fmt(n: number | null | undefined): string {
  if (n == null) return '-';
  return Number(n).toLocaleString('ko-KR');
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const year = now.getFullYear();
  const weekOfYear = Math.ceil((((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
  const month = now.getMonth() + 1;
  const slug = `weekly-digest-${year}-w${String(weekOfYear).padStart(2, '0')}`;
  const weekLabel = `${month}월 ${Math.ceil(now.getDate() / 7)}주차`;

  // Duplicate check
  const { data: existing } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, created: 0, reason: 'duplicate' });

  // 1. Popular posts this week
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const { data: popularPosts } = await admin.from('blog_posts')
    .select('slug, title, category, view_count')
    .eq('is_published', true)
    .gte('created_at', weekAgo)
    .order('view_count', { ascending: false })
    .limit(5);

  // 2. Index data
  const { data: indices } = await (admin as any).from('stock_quotes')
    .select('symbol, name, price, change_pct')
    .in('symbol', ['KOSPI_IDX', 'KOSDAQ_IDX']);

  // 3. Upcoming subscriptions
  const today = now.toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const { data: upcoming } = await (admin as any).from('apt_subscriptions')
    .select('house_nm, region_nm, rcept_bgnde, rcept_endde, tot_supply_hshld_co')
    .gte('rcept_bgnde', today)
    .lte('rcept_bgnde', nextWeek)
    .order('rcept_bgnde')
    .limit(5);

  // 4. Blog post counts this week
  const { count: weeklyPosts } = await admin.from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', weekAgo)
    .eq('is_published', true);

  // Build content
  const parts: string[] = [];
  const title = `카더라 주간 브리핑 — ${year}년 ${weekLabel}`;

  parts.push(`# ${title}`);
  parts.push('');
  parts.push(`${year}년 ${weekLabel} 카더라에서 다룬 주요 콘텐츠와 시장 동향을 정리합니다.`);
  parts.push('');

  // Market summary
  parts.push('## 이번주 시장');
  parts.push('');
  if (indices?.length) {
    parts.push('| 지수 | 현재가 | 주간 등락 |');
    parts.push('|---|---|---|');
    (indices ?? []).forEach((idx: any) => {
      const sign = Number(idx.change_pct) >= 0 ? '+' : '';
      parts.push(`| ${idx.name} | ${fmt(idx.price)} | ${sign}${Number(idx.change_pct).toFixed(2)}% |`);
    });
    parts.push('');
  }

  // Popular posts
  if (popularPosts?.length) {
    parts.push('## 이번주 인기 글 TOP 5');
    parts.push('');
    popularPosts.forEach((p: any, i: number) => {
      const catLabel = p.category === 'stock' ? '주식' : p.category === 'apt' ? '부동산' : p.category === 'unsold' ? '미분양' : '금융';
      parts.push(`${i + 1}. [${p.title}](/blog/${p.slug}) — ${catLabel} · 조회 ${fmt(p.view_count)}`);
    });
    parts.push('');
  }

  // Upcoming subscriptions
  if (upcoming?.length) {
    parts.push('## 다음주 청약 일정');
    parts.push('');
    parts.push('| 단지명 | 지역 | 접수 시작 | 세대수 |');
    parts.push('|---|---|---|---|');
    upcoming.forEach((s: any) => {
      parts.push(`| ${s.house_nm || '-'} | ${s.region_nm || '-'} | ${s.rcept_bgnde || '-'} | ${fmt(s.tot_supply_hshld_co)} |`);
    });
    parts.push('');
  }

  // Stats
  parts.push('## 이번주 카더라');
  parts.push('');
  parts.push(`- 발행 콘텐츠: **${fmt(weeklyPosts)}편**`);
  parts.push('');

  // CTA
  parts.push('---');
  parts.push('');
  parts.push('카더라에서 매주 업데이트되는 시장 분석과 청약 정보를 받아보세요.');
  parts.push('');
  parts.push('- [전체 블로그 보기](/blog)');
  parts.push('- [주식 시세 확인](/stock)');
  parts.push('- [청약 가점 계산기](/apt/diagnose)');
  parts.push('- [커뮤니티 토론](/discussion)');

  const content = parts.join('\n');
  if (content.length < 1000) {
    return NextResponse.json({ ok: true, created: 0, reason: 'content_too_short' });
  }

  const tags = ['주간브리핑', '카더라', '시장정리', weekLabel];
  const result = await safeBlogInsert(admin, {
    slug, title, content,
    excerpt: `${year}년 ${weekLabel} 시장 요약, 인기 글, 다음주 청약 일정을 정리합니다.`,
    category: 'stock', 
    tags,
    cron_type: 'weekly-digest',
    data_date: now.toISOString().slice(0, 10),
    cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&category=stock&author=${encodeURIComponent('카더라')}&design=2`,
    image_alt: generateImageAlt('stock', title),
    meta_description: generateMetaDesc(content),
    meta_keywords: generateMetaKeywords('stock', tags),
  });

  return NextResponse.json({ ok: true, created: result.success ? 1 : 0 });
});
