import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { submitIndexNow } from '@/lib/indexnow';
import { SITE_URL } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const { issue_id } = await req.json();
  if (!issue_id) return NextResponse.json({ error: 'issue_id required' }, { status: 400 });

  const { data: issue } = await (sb as any).from('issue_alerts').select('*').eq('id', issue_id).single();
  if (!issue) return NextResponse.json({ error: 'issue not found' }, { status: 404 });
  if (!issue.draft_title || !issue.draft_content) return NextResponse.json({ error: 'no draft content' }, { status: 400 });

  // 블로그 발행
  let blogId = issue.blog_post_id;
  if (blogId) {
    // 이미 draft로 저장된 경우 → published로 전환
    await sb.from('blog_posts').update({ is_published: true, published_at: new Date().toISOString() }).eq('id', blogId);
  } else {
    // 새로 INSERT
    const result = await safeBlogInsert(sb, {
      slug: issue.draft_slug,
      title: issue.draft_title,
      content: issue.draft_content,
      category: issue.category === 'stock' ? 'stock' : 'apt',
      tags: issue.draft_keywords || [],
      source_type: 'auto_issue',
      cron_type: 'issue-manual',
      source_ref: (issue.source_urls || [])[0],
      meta_description: (issue.summary || '').slice(0, 160),
      is_published: true,
    });
    blogId = result.id;
  }

  // issue_alerts 업데이트
  await (sb as any).from('issue_alerts').update({
    is_published: true,
    publish_decision: 'manual',
    blog_post_id: blogId,
    published_at: new Date().toISOString(),
  }).eq('id', issue_id);

  // IndexNow
  if (issue.draft_slug) {
    try { await submitIndexNow([`${SITE_URL}/blog/${issue.draft_slug}`]); } catch {}
  }

  // 피드 포스트 (공식)
  const { data: systemUser } = await sb.from('profiles').select('id').eq('nickname', '카더라').limit(1).maybeSingle();
  if (systemUser && issue.draft_slug) {
    const prefix = issue.category === 'apt' ? '🏠' : '📊';
    await sb.from('posts').insert({
      author_id: systemUser.id,
      title: `${prefix} ${(issue.related_entities || []).join(', ')} 분석`,
      content: `${prefix} ${issue.draft_title}\n\n상세 분석 👉 ${SITE_URL}/blog/${issue.draft_slug}`,
      category: issue.category === 'apt' ? 'realestate' : 'stock',
      is_anonymous: false,
    });
  }

  return NextResponse.json({ ok: true, blog_id: blogId, slug: issue.draft_slug });
}
