import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { submitIndexNow } from '@/lib/indexnow';
import { SITE_URL } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const { issue_id } = await req.json();
  if (!issue_id) return NextResponse.json({ error: 'issue_id required' }, { status: 400 });

  const { data: issue } = await (sb as any).from('issue_alerts').select('*').eq('id', issue_id).maybeSingle();
  if (!issue) return NextResponse.json({ error: 'issue not found' }, { status: 404 });
  if (!issue.draft_title || !issue.draft_content) {
    return NextResponse.json({ error: `draft 콘텐츠 없음 — issue-draft 크론 먼저 실행 필요 (publish_decision: ${issue.publish_decision || '미처리'})` }, { status: 400 });
  }

  let blogId = issue.blog_post_id;
  let insertError: string | null = null;

  if (blogId) {
    // 이미 draft로 저장된 경우 → published 전환
    const { error } = await sb.from('blog_posts')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('id', blogId);
    if (error) insertError = error.message;
  } else {
    // 새로 INSERT
    const blogCategory = (['apt','stock','finance','general'] as const).includes(issue.category as any)
      ? issue.category
      : (issue.category === 'tax' || issue.category === 'economy') ? 'finance' : 'general';
    const coverImage = `${SITE_URL}/api/og?title=${encodeURIComponent(issue.draft_title)}&category=${blogCategory}&author=${encodeURIComponent('카더라')}&design=2`;

    const result = await safeBlogInsert(sb, {
      slug: issue.draft_slug,
      title: issue.draft_title,
      content: issue.draft_content,
      category: blogCategory as any,
      tags: issue.draft_keywords || [],
      source_type: 'auto_issue',
      cron_type: 'issue-manual',
      source_ref: (issue.source_urls || [])[0],
      meta_description: (issue.summary || issue.draft_title || '').slice(0, 160),
      meta_keywords: (issue.draft_keywords || []).join(','),
      cover_image: coverImage,
      image_alt: `${issue.draft_title} — 카더라 분석`,
      is_published: true,
    });

    if (!result.success) {
      insertError = result.message || result.reason || '발행 실패';
    } else {
      blogId = result.id ? Number(result.id) : undefined;
      // slug으로 fallback 조회
      if (!blogId && issue.draft_slug) {
        const { data: found } = await sb.from('blog_posts').select('id').eq('slug', issue.draft_slug).maybeSingle();
        if (found) blogId = found.id;
      }
    }
  }

  if (insertError) {
    // 실패 원인 issue_alerts에 기록
    await (sb as any).from('issue_alerts').update({
      publish_decision: 'manual_failed',
      block_reason: insertError,
    }).eq('id', issue_id);
    return NextResponse.json({ error: `발행 실패: ${insertError}` }, { status: 400 });
  }

  // issue_alerts 업데이트
  await (sb as any).from('issue_alerts').update({
    is_published: true,
    is_processed: true,
    publish_decision: 'manual',
    blog_post_id: blogId,
    published_at: new Date().toISOString(),
  }).eq('id', issue_id);

  // IndexNow
  if (issue.draft_slug) {
    try { await submitIndexNow([`${SITE_URL}/blog/${issue.draft_slug}`]); } catch {}
  }

  // 피드 포스트
  const { data: systemUser } = await sb.from('profiles').select('id').eq('nickname', '카더라').limit(1).maybeSingle();
  if (systemUser && issue.draft_slug) {
    const prefix = issue.category === 'apt' ? '🏠' : '📊';
    const entities = (issue.related_entities || []).join(', ');
    try {
      await sb.from('posts').insert({
        author_id: systemUser.id,
        title: `${prefix} ${entities || '이슈'} 분석`,
        content: `${prefix} ${issue.draft_title}\n\n상세 분석 👉 ${SITE_URL}/blog/${issue.draft_slug}`,
        category: issue.category === 'apt' ? 'realestate' : 'stock',
        is_anonymous: false,
      });
    } catch { /* 피드 포스트 실패해도 발행은 유지 */ }
  }

  return NextResponse.json({ ok: true, blog_id: blogId, slug: issue.draft_slug });
}
