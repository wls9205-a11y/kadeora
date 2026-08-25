export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { safeBlogInsert, extractAptSiteSlugs } from '@/lib/blog-safe-insert';
import { recordSiteLinks } from '@/lib/blog/site-links';

/**
 * ADDENDUM §4-2 + §4-3 — 분양예정 + 청약 캘린더 (한 글로 묶음).
 *
 * ── ⚠️ 왜 둘을 합쳤나 ──
 * 청약만으로는 글이 안 된다. 실측 전국 접수중 8 · 예정 3 뿐이다.
 * §4-2(전국 분양예정)와 §4-3(지역 캘린더)을 따로 내면 양쪽 다 빈약해진다.
 * 합치면 전국 8+3+26 = 37건, 부울경 1+0+23 = 24건으로 글이 선다.
 *
 * ── 재료 ──
 * get_subscription_calendar(p_region, p_days) → jsonb
 *   open[]             접수 중        dday = 마감까지
 *   upcoming[]         접수 예정      dday = 시작까지
 *   pre_announcement[] 분양 예고      **일정 없음**
 *   open_count · soon_count · pre_count · total · publishable(합계 5건 이상)
 *
 * ── ⚠️ pre_announcement 는 날짜를 지어내지 않는다 ──
 * 공고 전이라 일정이 아예 없다. 별도 「분양 예정」 섹션에 두고
 * "일정은 아직 공고되지 않았습니다" 를 명시한다. dday 를 만들어 붙이면 거짓이 된다.
 *
 * ── ⚠️ 주마다 새 글을 만들지 않는다 (§4-1·§4-4 와 같은 similar_title 함정) ──
 * 지역별 URL 하나를 고정하고 본문을 갈아끼운다. 캘린더는 원래 그 형태가 맞다.
 */

const CRON_TYPE = 'subscription-calendar';

/** 기본 지역. '전국' 과 '부울경' 을 각각 낸다 — 검색 의도가 다르다. */
const DEFAULT_REGIONS = ['전국', '부울경'];

const DEFAULT_DAYS = 30;

/** 섹션별 상한. 넘치면 글이 표가 된다. */
const MAX_PER_SECTION = 20;

interface CalItem {
  slug: string;
  name: string;
  house_nm?: string | null;
  region: string | null;
  sigungu?: string | null;
  addr?: string | null;
  builder: string | null;
  supply_units: number | null;
  complex_units: number | null;
  variants: string[] | null;
  dday?: number | null;
  rcept_bgnde?: string | null;
  rcept_endde?: string | null;
  confidence?: string | null;
}

interface Calendar {
  region: string;
  days: number;
  total: number;
  open_count: number;
  soon_count: number;
  pre_count: number;
  publishable: boolean;
  open: CalItem[];
  upcoming: CalItem[];
  pre_announcement: CalItem[];
}

/** 앵커 회전 — 같은 앵커 반복은 과최적화 신호다. 링크 대상은 항상 /apt/{slug}. */
function anchor(item: CalItem, i: number): string {
  const pool = [item.name, ...(item.variants ?? [])].filter(
    (v): v is string => typeof v === 'string' && v.trim().length >= 3,
  );
  return pool.length === 0 ? item.slug : pool[i % pool.length];
}

/** ⚠️ 확정이 아니면 단정하지 않는다 (표시광고법). */
function unitsPhrase(item: CalItem): string | null {
  const soft = item.confidence && item.confidence !== 'confirmed' ? ' 예정' : '';
  if (item.complex_units && item.complex_units > 0) return `총 ${item.complex_units.toLocaleString('ko-KR')}세대${soft}`;
  if (item.supply_units && item.supply_units > 0) return `일반분양 ${item.supply_units.toLocaleString('ko-KR')}세대${soft}`;
  return null;
}

function where(item: CalItem): string | null {
  const w = [item.region, item.sigungu].filter(Boolean).join(' ');
  return w || (item.addr ? String(item.addr).slice(0, 30) : null);
}

function buildBody(c: Calendar, today: string): string {
  const lines: string[] = [];
  const scope = c.region === '전국' ? '전국' : c.region;

  lines.push(
    `${scope}에서 청약 접수 중이거나 접수를 앞둔 단지, 그리고 모집공고를 준비 중인 현장을 ${today} 기준으로 정리했습니다. ` +
      `접수 중 ${c.open_count}곳 · 접수 예정 ${c.soon_count}곳 · 분양 예정 ${c.pre_count}곳입니다.`,
  );

  /* ── 접수 중 — 마감이 가까운 순 ── */
  if (c.open.length > 0) {
    lines.push('');
    lines.push('## 지금 접수 중');
    lines.push('');
    lines.push('마감이 가까운 순입니다. 접수 일정은 모집공고 기준이며 변경될 수 있습니다.');
    lines.push('');
    c.open.slice(0, MAX_PER_SECTION).forEach((it, i) => {
      const d = typeof it.dday === 'number' ? (it.dday === 0 ? '오늘 마감' : `마감 D-${it.dday}`) : null;
      const bits = [d, where(it), it.builder, unitsPhrase(it)].filter(Boolean);
      lines.push(`- [${anchor(it, i)}](/apt/${it.slug})${bits.length ? ` — ${bits.join(' · ')}` : ''}`);
    });
  }

  /* ── 접수 예정 ── */
  if (c.upcoming.length > 0) {
    lines.push('');
    lines.push('## 접수 예정');
    lines.push('');
    c.upcoming.slice(0, MAX_PER_SECTION).forEach((it, i) => {
      const d = typeof it.dday === 'number' ? `${it.rcept_bgnde ?? ''} 시작 (D-${it.dday})`.trim() : it.rcept_bgnde ?? null;
      const bits = [d, where(it), it.builder, unitsPhrase(it)].filter(Boolean);
      lines.push(`- [${anchor(it, i)}](/apt/${it.slug})${bits.length ? ` — ${bits.join(' · ')}` : ''}`);
    });
  }

  /* ── 분양 예정 (공고 전) ── */
  // ⚠️ 여기에는 날짜가 없다. 만들어 붙이지 않는다.
  if (c.pre_announcement.length > 0) {
    lines.push('');
    lines.push('## 분양 예정 (모집공고 전)');
    lines.push('');
    lines.push(
      '아래 현장은 아직 모집공고가 나오지 않아 **접수 일정이 정해지지 않았습니다.** ' +
        '사업 단계와 공급 규모만 확인된 상태이며, 일정은 공고 시점에 확정됩니다.',
    );
    lines.push('');
    c.pre_announcement.slice(0, MAX_PER_SECTION).forEach((it, i) => {
      const bits = [where(it), it.builder, unitsPhrase(it)].filter(Boolean);
      lines.push(`- [${anchor(it, i)}](/apt/${it.slug})${bits.length ? ` — ${bits.join(' · ')}` : ''}`);
    });
  }

  lines.push('');
  lines.push(
    `접수 일정과 공급 세대수는 청약홈 모집공고를 기준으로 하며, 공고 전 현장은 사업 단계 자료를 정리한 것입니다. ` +
      `청약 자격과 최종 일정은 반드시 모집공고 원문에서 확인하시기 바랍니다.`,
  );

  return lines.join('\n');
}

async function handler(req: NextRequest) {
  const result = await withCronLogging('blog-subscription-calendar', async () => {
    const admin = getSupabaseAdmin() as any;

    const one = req.nextUrl.searchParams.get('region')?.trim();
    const regions = one ? [one] : DEFAULT_REGIONS;
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || DEFAULT_DAYS));

    const kst = new Date(Date.now() + 9 * 3600_000);
    const today = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;

    const { data: cfg } = await admin
      .from('blog_publish_config').select('min_content_length').eq('id', 1).maybeSingle();
    const minLen = Number(cfg?.min_content_length ?? 2000);

    let created = 0;
    let refreshed = 0;
    const skipped: Record<string, number> = {};
    const details: any[] = [];

    for (const region of regions) {
      const { data: raw, error } = await admin.rpc('get_subscription_calendar', {
        p_region: region,
        p_days: days,
      });
      if (error) { skipped.rpc_error = (skipped.rpc_error ?? 0) + 1; continue; }

      const c = raw as Calendar | null;
      if (!c) { skipped.no_data = (skipped.no_data ?? 0) + 1; continue; }

      // ⚠️ 대상이 적은 기간에는 글을 내지 않는다. 빈 캘린더를 만들지 않는다.
      if (!c.publishable) {
        skipped.not_publishable = (skipped.not_publishable ?? 0) + 1;
        details.push({ region, skipped: 'not_publishable', total: c.total, open: c.open_count, soon: c.soon_count, pre: c.pre_count });
        continue;
      }

      // 제목: 지역 + 실제 건수. 지역이 둘뿐이라 서로 충돌하지 않는다.
      const title =
        `${region} 청약 일정 총정리 — 접수 중 ${c.open_count}곳 · 예정 ${c.soon_count}곳 · 분양 예정 ${c.pre_count}곳 (${today})`;
      // ⚠️ slug 에 날짜를 넣지 않는다. 지역별 URL 하나를 고정하고 갈아끼운다.
      const slug = `${region}-청약-일정-총정리`.replace(/\s+/g, '-').toLowerCase();

      const content = buildBody(c, today);
      const excerpt =
        `${region} 청약 접수 중 ${c.open_count}곳, 접수 예정 ${c.soon_count}곳, 모집공고 전 분양 예정 ${c.pre_count}곳의 일정과 공급 규모를 정리했습니다.`;

      const { data: existingPost } = await admin
        .from('blog_posts').select('id').eq('slug', slug).maybeSingle();

      if (existingPost) {
        if (extractAptSiteSlugs(content).length === 0) {
          skipped.no_site_link = (skipped.no_site_link ?? 0) + 1;
          continue;
        }
        const { data: upd, error: updErr } = await admin
          .from('blog_posts')
          .update({ title, content, excerpt, updated_at: new Date().toISOString() })
          .eq('id', existingPost.id)
          .select('id');
        // ⚠️ 영향 행 수를 본다. 0건이면 갱신했다고 세지 않는다.
        if (updErr || (upd?.length ?? 0) === 0) {
          skipped.update_failed = (skipped.update_failed ?? 0) + 1;
          continue;
        }
        // §G-1: 갱신분도 대장에 적는다.
        await recordSiteLinks(admin, existingPost.id, content);
        refreshed++;
        details.push({ region, refreshed: true, links: extractAptSiteSlugs(content).length, title });
        continue;
      }

      if (content.length < minLen) {
        skipped.too_thin = (skipped.too_thin ?? 0) + 1;
        details.push({ region, skipped: 'too_thin', chars: content.length, min: minLen });
        continue;
      }

      const res = await safeBlogInsert(admin, {
        slug, title, content, excerpt,
        category: 'apt',
        tags: [region, '청약', '분양', '청약일정'],
        source_type: 'auto',
        cron_type: CRON_TYPE,
      });

      if (res.success) {
        created++;
        details.push({ region, created: true, links: (res.siteSlugs ?? []).length, title });
      } else {
        skipped[res.reason ?? 'unknown'] = (skipped[res.reason ?? 'unknown'] ?? 0) + 1;
        details.push({ region, skipped: res.reason });
      }
    }

    return {
      processed: regions.length,
      created,
      failed: 0,
      metadata: { days, regions, refreshed, skipped, details },
    };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
