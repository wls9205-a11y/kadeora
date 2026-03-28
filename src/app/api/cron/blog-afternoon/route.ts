export const maxDuration = 60;
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const TOPICS = [
  { slug: 'save-tip', title: '오늘의 절약 팁', cat: 'finance', tags: ['절약', '저축', '재테크'] },
  { slug: 'invest-strategy', title: '투자 전략 한 줄', cat: 'finance', tags: ['투자', '전략', '재테크'] },
  { slug: 'tax-tip', title: '세금 상식 한 줄', cat: 'finance', tags: ['세금', '절세', '연말정산'] },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = getSupabaseAdmin();
    const now = new Date();
    const dateSlug = now.toISOString().slice(0, 10);
    const today = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    let created = 0;

    for (const t of TOPICS) {
      const slug = `${t.slug}-${dateSlug}`;
      const { data: existing } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (existing) continue;

      const fullTitle = `${t.title} — ${today}`;
      const content = ensureMinLength(`# ${fullTitle}\n\n${fullTitle}에 대한 유용한 정보를 정리했습니다.\n\n오늘의 핵심 포인트를 확인해보세요.\n\n---\n\n카더라에서 매일 업데이트되는 재테크 정보를 받아보세요.`, t.cat);

      const result = await safeBlogInsert(admin, {
        slug, title: fullTitle, content,
        excerpt: `${today} ${t.title}. 카더라에서 확인하세요.`,
        category: t.cat, tags: t.tags,
        cron_type: 'afternoon', data_date: dateSlug,
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(fullTitle&design=2)}&type=blog`,
        image_alt: generateImageAlt(t.cat, fullTitle),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords(t.cat, t.tags),
      });
      if (result.success) created++;
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-afternoon]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 200 });
  }
}
