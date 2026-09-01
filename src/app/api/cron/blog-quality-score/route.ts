export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
// s258 patch #14: LLM 빈말 검출 + 외부 출처 카운트
import { checkBlogContent, countExternalLinks } from '@/lib/llm/post-process';

const BATCH = 50; // s173: 200 → 50 (Vercel 함수 60s 제한 + Supabase 연결풀 보호)

/**
 * 블로그 품질 자동 평가 크론
 * - 비공개 글 중 quality_checked_at이 NULL이거나 30일 경과한 글 대상
 * - 100점 만점 quality_score 산출
 * - auto_publish_eligible 자동 설정
 * 매시간 200건 처리 → 51K 전체 ~11일
 */

interface QualityDetails {
  length: number;
  structure: number;
  links: number;
  meta: number;
  image: number;
  uniqueness: number;
  freshness: number;
}

function scorePost(post: any): { score: number; details: QualityDetails; eligible: boolean } {
  const content: string = post.content || '';
  const contentLen: number = post.content_length || content.length;

  // 1. 콘텐츠 길이 (25점)
  let length = 0;
  if (contentLen >= 4000) length = 25;
  else if (contentLen >= 3000) length = 20;
  else if (contentLen >= 2500) length = 15;
  else if (contentLen >= 2000) length = 10;
  else if (contentLen >= 1000) length = 5;

  // 2. 구조화 (20점) — H2, H3, 리스트, 테이블 (HTML + 마크다운 양쪽 지원)
  let structure = 0;
  const h2Count = (content.match(/<h2/gi) || []).length + (content.match(/^## [^#]/gm) || []).length;
  const h3Count = (content.match(/<h3/gi) || []).length + (content.match(/^### [^#]/gm) || []).length;
  const hasList = /<[uo]l/i.test(content) || /^[-*] /m.test(content) || /^\d+\. /m.test(content);
  const hasTable = /<table/i.test(content) || /\|[-:]+\|/.test(content);
  if (h2Count >= 3) structure += 10; else if (h2Count >= 2) structure += 7; else if (h2Count >= 1) structure += 4;
  if (h3Count >= 1) structure += 5;
  if (hasList || hasTable) structure += 5;

  // 3. 내부링크 (15점) — HTML href + 마크다운 [](/) 양쪽 지원
  let links = 0;
  const relatedSlugs = post.related_slugs || [];
  if (relatedSlugs.length >= 3) links += 10; else if (relatedSlugs.length >= 1) links += 5;
  const htmlLinks = (content.match(/href="\/(?!api)/gi) || []).length;
  const mdLinks = (content.match(/\]\(\/(apt|stock|blog|calc|feed|search|daily|discuss)/g) || []).length;
  const internalLinks = htmlLinks + mdLinks;
  if (internalLinks >= 3) links += 5; else if (internalLinks >= 1) links += 3;

  // 4. 메타데이터 (15점)
  let meta = 0;
  const titleLen = (post.title || '').length;
  if (titleLen >= 20 && titleLen <= 55) meta += 5; else if (titleLen >= 15 && titleLen <= 60) meta += 3;
  const descLen = (post.meta_description || '').length;
  if (descLen >= 50 && descLen <= 150) meta += 5; else if (descLen >= 30) meta += 3;
  if (post.excerpt && post.excerpt.length > 20) meta += 5;

  // 5. 이미지 (10점)
  let image = 0;
  const coverImage = post.cover_image || '';
  if (coverImage && !coverImage.includes('/api/og')) image += 5; else if (coverImage) image += 2;
  if (post.image_alt && post.image_alt.length > 5) image += 5;

  // 6. 고유성 + 완성도 (10점) — FAQ 있으면 보너스, 면책 있으면 보너스
  let uniqueness = 0;
  const hasFaq = /<(div|section)[^>]*class[^>]*faq/i.test(content) || /자주 묻는 질문|FAQ/i.test(content) || /^(?:\*\*)?Q\./m.test(content);
  const hasDisclaimer = /면책|disclaimer|투자.*책임|개인.*의견|데이터 출처/i.test(content);
  if (hasFaq) uniqueness += 5; else uniqueness += 1;
  if (hasDisclaimer) uniqueness += 5; else uniqueness += 1;

  // 7. 데이터 신선도 (5점)
  let freshness = 0;
  const dateRef = post.data_date || post.rewritten_at || post.created_at;
  if (dateRef) {
    const daysDiff = Math.floor((Date.now() - new Date(dateRef).getTime()) / 86400000);
    if (daysDiff <= 30) freshness = 5;
    else if (daysDiff <= 90) freshness = 3;
    else if (daysDiff <= 365) freshness = 1;
  }

  // s258 patch #14: LLM 빈말 차감
  const llmCheck = checkBlogContent(content);
  const llmPenalty = Math.min(40, llmCheck.total_penalty);
  // 외부 출처/비교표 가산
  const externalLinkBonus = countExternalLinks(content) >= 1 ? 5 : 0;

  const details: QualityDetails & { llm_hits?: any; llm_penalty?: number; needs_regeneration?: boolean } = {
    length, structure, links, meta, image, uniqueness, freshness,
    llm_hits: llmCheck.hits,
    llm_penalty: llmPenalty,
    needs_regeneration: llmCheck.needs_regeneration,
  };
  const score = Math.max(0, Math.min(100,
    length + structure + links + meta + image + uniqueness + freshness + externalLinkBonus - llmPenalty
  ));

  // 자동 공개 자격: score >= 65 AND seo_tier S/A/restore_candidate AND content >= 2500자
  const eligibleTiers = ['S', 'A', 'restore_candidate'];
  const eligible = score >= 65 && eligibleTiers.includes(post.seo_tier || '') && contentLen >= 2500;

  return { score, details, eligible };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-quality-score', async () => {
    const sb = getSupabaseAdmin();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    /* 평가 대상: 비공개 + (미평가 OR 30일 경과)
     *
     * ⚠️ A3(2026-08-27) — 지시서는 `quality_checked_at < published_at` 증분을 요구했으나
     *    PostgREST 는 «컬럼 대 컬럼» 비교를 지원하지 않는다. 표현할 방법이 없다.
     *    아래 조건이 이미 증분이다(미평가 OR 30일 경과) — 매번 전량을 훑지 않는다.
     *    주기를 매시 → 하루 1회(0 2 * * *)로 낮춘 것으로 부하 목표는 달성된다.
     */
    const { data: posts, error } = await (sb as any)
      .from('blog_posts')
      .select('id, title, content, content_length, excerpt, meta_description, cover_image, image_alt, category, tags, related_slugs, seo_tier, seo_score, data_date, rewritten_at, created_at')
      .or(`is_published.eq.false,and(is_published.eq.true,quality_score.eq.0)`)
      .or(`quality_checked_at.is.null,quality_checked_at.lt.${thirtyDaysAgo}`)
      .order('quality_checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH);

    if (error) throw new Error(`query error: ${error.message}`);
    if (!posts?.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_targets' } };

    /* ─── s268(산식-가): 미발행 글 «티어» 채점 — seo-score-refresh 에서 옮겨 왔다 ───────
     *
     * seo-score-refresh 는 .eq('is_published', true) 라 미발행 글의 seo_tier 를 갱신한 적이
     * 없고(30일 0회 실행 · 등록도 없음), auto_publish_eligible 은 seo_tier ∈ {S,A,...} 를
     * 요구한다 → 미발행 글은 영원히 발행 후보에 들지 못한다.
     *
     * 산식 교정: view_count(25)와 반응(10)을 뺀다. 둘 다 «발행 이후에만 생기는 값» 이라
     * 발행 자격 판정에 넣는 것은 순환 참조다. 만점 100 → 65, 문턱은 같은 비율(×0.65):
     * S 46 · A 33 · B 20 · C 10 — 정규화라 문턱을 낮추지 않았음이 산술로 보인다.
     *
     * 대상 한정: 백필 큐를 «탄» 글만. 전면 적용 시 미발행 30,474편이 eligible 이 되어
     * BATCH 50 × 매시로 약 25일간 자동 발행된다(실측).
     *
     * 이 크론 안에 두는 이유: 이미 02:00 에 등록돼 있고 이미 미발행 글을 대상으로 돈다.
     * 별도 크론을 만들면 중복 기동이고, seo-score-refresh 에 두면 등록이 필요해진다.
     */
    let unpubTierUpdated = 0;
    try {
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: qRows } = await (sb as any)
        .from('blog_image_backfill_queue')
        .select('post_id')
        .or(`completed_at.gte.${since7},queued_at.gte.${since7}`)
        .limit(2000);
      const qIds = Array.from(new Set((qRows || []).map((r: any) => r.post_id))).slice(0, 500);
      if (qIds.length) {
        const { data: unpub } = await (sb as any)
          .from('blog_posts')
          .select('id, content, sub_category, source_ref, rewritten_at, title, seo_tier')
          .eq('is_published', false)
          .in('id', qIds)
          .not('seo_tier', 'in', '(restore_candidate,restored,cooldown)');
        for (const p of (unpub || [])) {
          const len = (p.content || '').length;
          const sc =
            (len >= 5000 ? 25 : len >= 4000 ? 22 : len >= 3000 ? 18 : len >= 2000 ? 10 : 5) +
            (p.sub_category ? 15 : 0) +
            (p.source_ref ? 10 : 0) +
            (p.rewritten_at && len >= 3000 ? 10 : p.rewritten_at ? 5 : 0) +
            (p.title && !p.title.includes('시세 분석') && !p.title.includes('투자 전망') ? 5 : 2);
          const tier = sc >= 46 ? 'S' : sc >= 33 ? 'A' : sc >= 20 ? 'B' : sc >= 10 ? 'C' : 'D';
          if (p.seo_tier !== tier) {
            await (sb as any).from('blog_posts')
              .update({ seo_score: sc, seo_tier: tier })
              .eq('id', p.id);
            unpubTierUpdated++;
            // 아래 채점 루프는 위에서 «이미 읽어 온» posts 배열을 쓴다. 여기서 메모리도 같이
            // 고치지 않으면 티어가 올라간 그 실행에서는 옛 값으로 eligible 을 판정하고,
            // 반영은 다음 날로 밀린다 — 하루를 잃는다.
            const inMem = (posts as any[]).find((x) => x.id === p.id);
            if (inMem) { inMem.seo_tier = tier; inMem.seo_score = sc; }
          }
        }
      }
    } catch (e: any) {
      console.error('[blog-quality-score] unpublished tier pass failed:', e?.message);
    }

    let updated = 0;
    let eligible = 0;
    let failed = 0;
    const updateErrors: string[] = [];
    const scoreDist: Record<string, number> = { 'S(80+)': 0, 'A(65-79)': 0, 'B(40-64)': 0, 'C(<40)': 0 };

    for (const post of posts) {
      try {
        const { score, details, eligible: isEligible } = scorePost(post);

        // r4-P10-1: 반환값을 안 보면 update 가 전부 실패해도 success 로 보고된다.
        // 이 프로젝트에서 네 번째로 확인된 침묵 실패 패턴이다
        // (crawl-apt-resale · gsc-sync · batch-rewrite-submit 에 이어).
        const { error: upErr } = await (sb as any).from('blog_posts').update({
          quality_score: score,
          quality_details: details,
          quality_checked_at: new Date().toISOString(),
          auto_publish_eligible: isEligible,
          content_length: post.content_length || (post.content || '').length,
        }).eq('id', post.id);
        if (upErr) {
          failed++;
          if (updateErrors.length < 3) updateErrors.push(upErr.message ?? String(upErr));
          console.error('[blog-quality-score] update fail', post.id, upErr.message?.slice(0, 200));
          continue;
        }

        updated++;
        if (isEligible) eligible++;
        if (score >= 80) scoreDist['S(80+)']++;
        else if (score >= 65) scoreDist['A(65-79)']++;
        else if (score >= 40) scoreDist['B(40-64)']++;
        else scoreDist['C(<40)']++;
      } catch {
        failed++;
      }
    }

    return {
      processed: posts.length,
      created: eligible,
      updated,
      failed,
      metadata: {
        eligible_count: eligible,
        score_distribution: scoreDist,
        ...(updateErrors.length ? { update_errors: updateErrors } : {}),
      },
    };
  });

  return NextResponse.json(result);
}
