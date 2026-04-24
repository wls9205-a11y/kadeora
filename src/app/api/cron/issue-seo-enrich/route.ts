/**
 * [CI-v1 Phase 2] issue-seo-enrich — meta_description 150~160자 + JSON-LD Article
 *
 * 대상:
 *   image_attached_at IS NOT NULL
 *   AND seo_enriched_at IS NULL
 *   AND blog_post_id IS NOT NULL
 *   LIMIT 10
 *
 * 동작:
 *   1) blog_posts 로드
 *   2) meta_description 150~160자 범위 보정 (기존 < 150 이면 summary/excerpt/content로 확장)
 *   3) JSON-LD Article schema 생성 → blog_posts.metadata.json_ld 저장
 *   4) seo_enriched_at 스탬프 + advance_issue_stage(id,'seo')
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 120;
export const runtime = 'nodejs';

const MAX_PER_RUN = 20; // T5 (s168): 1,388건 백로그 소진 가속 — 외부 API 無, DB I/O only
const PREEMPT_MS = 100_000;

const META_MIN = 150;
const META_MAX = 160;

function stripMarkdown(s: string): string {
  return (s || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[#*>`|_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function composeMetaDescription(input: {
  current?: string | null;
  title: string;
  summary?: string | null;
  excerpt?: string | null;
  content: string;
}): string {
  const cur = (input.current || '').trim();
  if (cur.length >= META_MIN && cur.length <= META_MAX) return cur;

  // 1차 소스: summary → excerpt → content (stripped)
  const parts: string[] = [];
  if (input.summary) parts.push(stripMarkdown(input.summary));
  if (input.excerpt) parts.push(stripMarkdown(input.excerpt));
  parts.push(stripMarkdown(input.content).slice(0, 400));

  let joined = parts.filter((p) => p && p.length > 0).join(' ').replace(/\s+/g, ' ').trim();
  if (joined.length === 0) joined = input.title;

  // 먼저 가장 의미 있는 첫 구간 추출
  let base = joined.slice(0, META_MAX);

  // 너무 짧으면 title 을 앞에 prepend
  if (base.length < META_MIN) {
    const prefix = `${input.title} — `;
    base = (prefix + joined).replace(/\s+/g, ' ').trim().slice(0, META_MAX);
  }

  // 길이 조정: 150 미만이면 '· 카더라 분석' 같은 꼬리 추가
  if (base.length < META_MIN) {
    base = (base + ' · 카더라 데이터 분석').slice(0, META_MAX);
  }

  // 문장 경계에서 깔끔히 자르기 (151~160 사이를 목표)
  if (base.length > META_MAX) {
    base = base.slice(0, META_MAX);
  }
  return base;
}

function buildArticleJsonLd(params: {
  title: string;
  description: string;
  slug: string;
  coverImage: string | null;
  category: string;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  authorName: string;
}): Record<string, any> {
  const url = `${SITE_URL.replace(/\/$/, '')}/blog/${params.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: params.title.slice(0, 110),
    description: params.description,
    image: params.coverImage ? [params.coverImage] : undefined,
    datePublished: params.publishedAt || new Date().toISOString(),
    dateModified: params.updatedAt || new Date().toISOString(),
    articleSection: params.category,
    keywords: (params.tags || []).slice(0, 12).join(','),
    author: {
      '@type': 'Organization',
      name: params.authorName || '카더라',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: '카더라',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL.replace(/\/$/, '')}/logo.png`,
      },
    },
    inLanguage: 'ko-KR',
    url,
  };
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('issue-seo-enrich', async () => {
      const sb = getSupabaseAdmin();
      const start = Date.now();

      const { data: pending, error: fetchErr } = await (sb as any)
        .from('issue_alerts')
        .select('id, title, summary, blog_post_id')
        .not('image_attached_at', 'is', null)
        .is('seo_enriched_at', null)
        .not('blog_post_id', 'is', null)
        .order('final_score', { ascending: false })
        .limit(MAX_PER_RUN);

      if (fetchErr) return { processed: 0, failed: 1, metadata: { error: fetchErr.message } };
      if (!pending || pending.length === 0) {
        return { processed: 0, metadata: { message: 'no pending seo candidates' } };
      }

      let enriched = 0;
      let metaFixed = 0;
      let failed = 0;
      const failures: string[] = [];
      const samples: any[] = [];

      for (const issue of pending as any[]) {
        if (Date.now() - start > PREEMPT_MS) break;
        try {
          const { data: post, error: postErr } = await sb
            .from('blog_posts')
            .select('id, slug, title, content, excerpt, category, tags, cover_image, meta_description, metadata, published_at, updated_at, author_name')
            .eq('id', issue.blog_post_id)
            .maybeSingle();
          if (postErr || !post) {
            failures.push(`${issue.id}:post_load_failed:${postErr?.message || 'no row'}`);
            failed++;
            continue;
          }

          const newMeta = composeMetaDescription({
            current: post.meta_description,
            title: post.title,
            summary: issue.summary,
            excerpt: post.excerpt,
            content: post.content,
          });
          const metaChanged = newMeta !== (post.meta_description || '');

          const jsonLd = buildArticleJsonLd({
            title: post.title,
            description: newMeta,
            slug: post.slug,
            coverImage: post.cover_image,
            category: post.category || 'general',
            tags: Array.isArray(post.tags) ? post.tags : [],
            publishedAt: post.published_at,
            updatedAt: post.updated_at,
            authorName: post.author_name || '카더라',
          });

          const prevMeta = (post.metadata && typeof post.metadata === 'object') ? post.metadata : {};
          const mergedMetadata = {
            ...(prevMeta as Record<string, any>),
            json_ld: jsonLd,
            seo_enriched_at: new Date().toISOString(),
            seo_enriched_by: 'issue-seo-enrich',
          };

          const updatePayload: Record<string, any> = {
            metadata: mergedMetadata,
          };
          if (metaChanged) {
            updatePayload.meta_description = newMeta;
            metaFixed++;
          }

          const { error: updErr } = await sb.from('blog_posts').update(updatePayload).eq('id', post.id);
          if (updErr) {
            failures.push(`${issue.id}:post_update_failed:${updErr.message}`);
            failed++;
            continue;
          }

          await (sb as any)
            .from('issue_alerts')
            .update({ seo_enriched_at: new Date().toISOString() })
            .eq('id', issue.id);
          try {
            await (sb as any).rpc('advance_issue_stage', {
              p_issue_id: issue.id,
              p_stage: 'seo',
            });
          } catch (stageErr: any) {
            failures.push(`${issue.id}:advance:${stageErr?.message || ''}`);
          }

          enriched++;
          if (samples.length < 5) {
            samples.push({
              id: issue.id,
              post: post.id,
              meta_len: newMeta.length,
              meta_changed: metaChanged,
              title: String(post.title || '').slice(0, 40),
            });
          }
        } catch (err: any) {
          failed++;
          failures.push(`${issue.id}:exception:${err?.message || 'unknown'}`);
        }
      }

      const elapsedMs = Date.now() - start;
      console.warn(
        `[issue-seo-enrich] processed=${pending.length} enriched=${enriched} meta_fixed=${metaFixed} failed=${failed} elapsed_ms=${elapsedMs}`,
      );

      return {
        processed: pending.length,
        created: enriched,
        updated: metaFixed,
        failed,
        metadata: {
          enriched,
          meta_fixed: metaFixed,
          batch_size: MAX_PER_RUN,
          samples,
          sample_failures: failures.slice(0, 5),
          elapsed_ms: elapsedMs,
        },
      };
    }, { redisLockTtlSec: 150 }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
