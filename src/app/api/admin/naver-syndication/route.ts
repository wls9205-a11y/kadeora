import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 네이버 발행 관리 API (admin only)
 * GET: 목록 조회 + 오늘 발행 잔여 한도
 * POST: 수동 상태 업데이트 (mark_blog_published, skip, retry)
 *
 * [§7] 네이버 블로그에는 «공개 발행 API 가 없다.» 자동 발행 워커는 존재한 적이 없고
 *   구조상 만들 수도 없다 — 크론이 naver_html 을 만들어 큐에 넣고, 사람이 어드민에서
 *   복사해 네이버 블로그에 붙여넣는 흐름이다. 그래서 "워커 재가동" 이 아니라
 *   «사람이 한 번에 밀어버리지 못하게 막는 것» 이 여기서의 일 상한이다.
 */

/**
 * [§7-3] 일 발행 상한. 큐에 81건이 밀려 있어 한 번에 올리면 스팸 판정 위험이 크다.
 *   생성 쪽 크론도 BATCH_SIZE=3 이라 정상 흐름에서는 하루 3건씩 쌓인다.
 */
const DAILY_PUBLISH_CAP = 3;

/**
 * [애드덤2 §C-4] 큐 정렬 = 전략.
 *   붙여넣기는 사람이 하고 일 3건 상한이라, 큐의 «순서» 가 곧 무엇을 먼저 노출할지의
 *   결정이다. hub_apt_slug 로 현장을 붙여 지역·단계를 보여주고 부울경 파이프라인을
 *   맨 위로 올린다.
 */
const BUULGYEONG = new Set(['부산', '울산', '경남']);

/** 애드덤1 §3 색 매핑과 «같은» 분류다. 한쪽만 바꾸면 화면과 큐가 어긋난다. */
const REDEV_STAGES = new Set([
  'union_established', 'constructor_selected', 'plan_approved', 'mgmt_approved', 'construction',
]);
const SELLING = new Set(['분양중', '선착순', '잔여세대']);

/** 파이프라인 = 분양·분양예정·미분양·정비. 기축(분양완료·입주예정·landmark_active)은 제외. */
function classifySite(site: any): { bucket: string; isPipeline: boolean } {
  if (!site) return { bucket: '현장 미연결', isPipeline: false };
  const cs = site.curated_status;
  if (cs && SELLING.has(cs)) return { bucket: '분양', isPipeline: true };
  if (cs === '분양예정') return { bucket: '분양예정', isPipeline: true };
  if (cs === '미분양') return { bucket: '미분양', isPipeline: true };
  if (!cs && REDEV_STAGES.has(site.lifecycle_stage)) return { bucket: '정비', isPipeline: true };
  return { bucket: '기축', isPipeline: false };
}

export async function GET() {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const sb = getSupabaseAdmin();

  const { data: rawItems } = await (sb as any).from('naver_syndication')
    .select('id, blog_slug, blog_post_id, original_title, naver_title, naver_tags, category, target, blog_status, cafe_status, cafe_article_id, cafe_retry_count, cafe_error, cafe_published_at, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  // [애드덤2 §C-4] blog_slug → blog_posts.hub_apt_slug → apt_sites 로 현장을 붙인다.
  //   2단계 조회다 — naver_syndication 에는 현장 참조가 없고 hub_apt_slug 는
  //   blog_posts 에만 있다. 50건 상한이라 IN 절 두 번으로 끝난다.
  const slugs = [...new Set((rawItems || []).map((i: any) => i.blog_slug).filter(Boolean))];
  const { data: postRows } = slugs.length
    ? await (sb as any).from('blog_posts').select('slug, hub_apt_slug').in('slug', slugs)
    : { data: [] };
  const hubBySlug = new Map<string, string | null>(
    (postRows || []).map((p: any) => [p.slug, p.hub_apt_slug]));

  const hubSlugs = [...new Set([...hubBySlug.values()].filter(Boolean))] as string[];
  const { data: siteRows } = hubSlugs.length
    ? await (sb as any).from('apt_sites')
        .select('slug, name, display_name, region, sigungu, lifecycle_stage, curated_status')
        .in('slug', hubSlugs)
    : { data: [] };
  const siteBySlug = new Map<string, any>((siteRows || []).map((s: any) => [s.slug, s]));

  const items = (rawItems || []).map((i: any) => {
    const hub = hubBySlug.get(i.blog_slug) || null;
    const site = hub ? siteBySlug.get(hub) || null : null;
    const { bucket, isPipeline } = classifySite(site);
    const region = site?.region || null;
    return {
      ...i,
      hub_apt_slug: hub,
      site_name: site ? (site.display_name || site.name) : null,
      region,
      sigungu: site?.sigungu || null,
      lifecycle_stage: site?.lifecycle_stage || null,
      curated_status: site?.curated_status || null,
      stage_bucket: bucket,
      is_pipeline: isPipeline,
      is_buulgyeong: !!region && BUULGYEONG.has(region),
    };
  });

  // 부울경 파이프라인 → 부울경 그 외 → 타지역 파이프라인 → 나머지. 그룹 안에서는 최신순.
  const rank = (x: any) => (x.is_buulgyeong ? (x.is_pipeline ? 0 : 1) : (x.is_pipeline ? 2 : 3));
  items.sort((a: any, b: any) =>
    rank(a) - rank(b) || String(b.created_at).localeCompare(String(a.created_at)));

  // 오늘(KST) 이미 발행한 건수 — 잔여 한도 계산용.
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstToday = kstNow.toISOString().slice(0, 10);
  const { count: publishedToday } = await (sb as any).from('naver_syndication')
    .select('id', { count: 'exact', head: true })
    .eq('blog_status', 'published')
    .gte('published_at', `${kstToday}T00:00:00+09:00`)
    .lte('published_at', `${kstToday}T23:59:59+09:00`);

  const usedToday = publishedToday || 0;
  const remainingToday = Math.max(0, DAILY_PUBLISH_CAP - usedToday);

  // 카페는 폐지됐다. pending/published/failed 는 블로그 상태만으로 센다.
  const pending = (items || []).filter((i: any) => i.blog_status === 'pending').length;
  const published = (items || []).filter((i: any) => i.blog_status === 'published').length;
  const failed = (items || []).filter((i: any) => i.blog_status === 'failed').length;

  // 큐 구성 — 위에서부터 몇 건이 실제로 부울경 파이프라인인지 한눈에 보이게.
  const pendingItems = items.filter((i: any) => i.blog_status === 'pending');
  const queueMix = {
    buulgyeong_pipeline: pendingItems.filter((i: any) => i.is_buulgyeong && i.is_pipeline).length,
    buulgyeong_other: pendingItems.filter((i: any) => i.is_buulgyeong && !i.is_pipeline).length,
    other_pipeline: pendingItems.filter((i: any) => !i.is_buulgyeong && i.is_pipeline).length,
    unlinked: pendingItems.filter((i: any) => i.stage_bucket === '현장 미연결').length,
  };

  return NextResponse.json({
    ok: true,
    items,
    stats: { pending, published, failed, total: items.length },
    dailyCap: { cap: DAILY_PUBLISH_CAP, usedToday, remainingToday, date: kstToday },
    queueMix,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const sb = getSupabaseAdmin();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ ok: false, error: 'id_and_action_required' }, { status: 400 });
  }

  if (action === 'mark_blog_published') {
    // [§7-3] 일 상한을 «서버에서» 강제한다. UI 배지만으로는 실수로 연타하면 그대로 넘어간다.
    const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { count } = await (sb as any).from('naver_syndication')
      .select('id', { count: 'exact', head: true })
      .eq('blog_status', 'published')
      .gte('published_at', `${kstToday}T00:00:00+09:00`)
      .lte('published_at', `${kstToday}T23:59:59+09:00`);
    if ((count || 0) >= DAILY_PUBLISH_CAP) {
      return NextResponse.json({
        ok: false,
        error: 'daily_cap_reached',
        message: `오늘 발행 한도(${DAILY_PUBLISH_CAP}건)를 채웠습니다. 큐 81건을 한 번에 올리면 네이버 스팸 판정 위험이 있어 막아둡니다.`,
        cap: DAILY_PUBLISH_CAP,
        usedToday: count || 0,
      }, { status: 429 });
    }
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);
  } else if (action === 'skip') {
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'skipped', cafe_status: 'skipped' })
      .eq('id', id);
  } else if (action === 'retry') {
    // [§7 / §2-4] 카페 발행 워커는 폐지됐다(라우트 파일 없음). retry 는 블로그만 되돌린다.
    //   구 `retry_cafe` 액션은 cafe_status 를 pending 으로 되살려 큐를 다시 묶어버리므로 제거한다.
    await (sb as any).from('naver_syndication')
      .update({ blog_status: 'pending', published_at: null, cafe_status: 'skipped' })
      .eq('id', id);
  } else {
    return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
