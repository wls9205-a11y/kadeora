/**
 * naver-cafe-publish — 네이버 카페 자동 발행 크론
 *
 * 한글 깨짐 영구 해결:
 * - cafe-client.ts (URL-encoded; charset=utf-8)
 * - cafe-html.ts (안전 HTML 정화)
 * - oauth-store.ts (refresh token rotation)
 * - app_config (한도/배치/스위치 DB 관리, 무하드코딩)
 *
 * 마스터 킬 스위치: app_config.master_kill.all_publishing_paused
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { postCafeArticle } from '@/lib/naver/cafe-client';
import { toNaverCafeHtml, appendSourceBox } from '@/lib/naver/cafe-html';
import { getValidAccessToken } from '@/lib/naver/oauth-store';
import { getConfig } from '@/lib/app-config';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface PublishResult {
  id: number;
  ok: boolean;
  articleId?: string;
  error?: string;
  status?: number;
}

async function doWork() {
  const sb = getSupabaseAdmin();

  // ── 마스터 킬 스위치 ──
  const kill = await getConfig('master_kill', {
    all_publishing_paused: false,
    all_crons_paused: false,
  });
  if (kill.all_crons_paused || kill.all_publishing_paused) {
    return { processed: 0, metadata: { reason: 'master_kill', kill } };
  }

  // ── 설정 로드 ──
  const cfg = await getConfig('naver_cafe', {
    enabled: true,
    batch_size: 1,
    sleep_between_ms: 2000,
    daily_limit: 8,
  });
  if (!cfg.enabled) {
    return { processed: 0, metadata: { reason: 'disabled_by_config' } };
  }

  // ── 일일 한도 ──
  const today = new Date().toISOString().slice(0, 10);
  const { count: todayCount } = await (sb as any)
    .from('naver_syndication')
    .select('id', { count: 'exact', head: true })
    .eq('cafe_status', 'published')
    .gte('cafe_published_at', `${today}T00:00:00Z`);

  const sentToday = todayCount || 0;
  if (sentToday >= cfg.daily_limit) {
    return { processed: 0, metadata: { reason: 'daily_limit_reached', sentToday, limit: cfg.daily_limit } };
  }

  // ── OAuth 토큰 ──
  const tokenInfo = await getValidAccessToken('naver_cafe');
  if (!tokenInfo) {
    return { processed: 0, metadata: { reason: 'oauth_not_configured', hint: '어드민 NaverPublishTab에서 OAuth 등록 필요' } };
  }
  const { token, meta, warning } = tokenInfo;
  const cafeId = String(meta.cafeId || '');
  const menuId = String(meta.menuId || '');
  if (!cafeId || !menuId) {
    return { processed: 0, metadata: { reason: 'cafe_or_menu_id_missing', meta } };
  }

  // ── 발행 큐 ──
  const remaining = cfg.daily_limit - sentToday;
  const batchLimit = Math.min(cfg.batch_size, remaining);
  const { data: pending } = await (sb as any)
    .from('naver_syndication')
    .select('id, blog_slug, blog_post_id, original_title, naver_title, naver_html, cafe_retry_count')
    .eq('cafe_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchLimit);

  if (!pending?.length) {
    return { processed: 0, metadata: { reason: 'no_pending', sentToday, limit: cfg.daily_limit } };
  }

  const results: PublishResult[] = [];
  let success = 0;

  for (const item of pending) {
    const canonicalUrl = `${SITE_URL}/blog/${item.blog_slug}`;

    // 본문 정화 + 출처 박스
    const cleanContent = toNaverCafeHtml(item.naver_html || '', { siteUrl: SITE_URL });
    const finalContent = appendSourceBox(cleanContent, {
      canonicalUrl,
      title: item.original_title || item.naver_title,
    });

    // 제목 정리: 네이버 카페 제목 한도 (실측 60자 안전)
    const subject = (item.naver_title || item.original_title || '')
      .replace(/[|~`<>]/g, '')
      .trim()
      .slice(0, 60);

    if (!subject || finalContent.length < 50) {
      // 데이터 자체가 부실하면 영구 실패 처리
      await (sb as any).from('naver_syndication').update({
        cafe_status: 'failed',
        cafe_error: 'subject_or_content_too_short',
      }).eq('id', item.id);
      results.push({ id: item.id, ok: false, error: 'subject_or_content_too_short' });
      continue;
    }

    const result = await postCafeArticle({
      accessToken: token,
      cafeId, menuId,
      subject, content: finalContent,
    });

    if (result.ok && result.articleId) {
      const publishedAt = new Date().toISOString();
      await (sb as any).from('naver_syndication').update({
        cafe_status: 'published',
        cafe_article_id: result.articleId,
        cafe_published_at: publishedAt,
        published_at: publishedAt,
      }).eq('id', item.id);
      success++;
      results.push({ id: item.id, ok: true, articleId: result.articleId });
    } else {
      const status = result.status || 0;
      const isPermanent = status >= 400 && status < 500 && status !== 429 && status !== 401;
      const newRetryCount = (item.cafe_retry_count || 0) + 1;
      const giveUp = isPermanent || newRetryCount >= 5;
      await (sb as any).from('naver_syndication').update({
        cafe_status: giveUp ? 'failed' : 'pending',
        cafe_error: result.error?.slice(0, 500) || `status_${status}`,
        cafe_retry_count: newRetryCount,
      }).eq('id', item.id);
      results.push({ id: item.id, ok: false, error: result.error, status });
    }

    // Rate limit sleep (마지막 건은 대기 안 함)
    if (results.length < batchLimit) {
      await new Promise(r => setTimeout(r, cfg.sleep_between_ms));
    }
  }

  return {
    processed: success,
    failed: results.length - success,
    metadata: { results, sentToday: sentToday + success, dailyLimit: cfg.daily_limit, warning },
  };
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('naver-cafe-publish', doWork);
  return NextResponse.json(result);
});
