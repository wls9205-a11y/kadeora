export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  TYPE 5 — 투자 일정 캘린더 (4 posts: 4~7월)                         */
/* ------------------------------------------------------------------ */

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  event_date: string;
  event_type: string;
  importance: string;
  country: string;
}

interface Subscription {
  house_nm: string;
  region_nm: string;
  rcept_bgnde: string;
  rcept_endde: string;
}

const BADGE: Record<string, string> = {
  '실적발표': '🔵',
  '청약': '🟢',
  'IPO': '🟡',
  '배당': '🔴',
};

function badge(eventType: string): string {
  for (const [key, emoji] of Object.entries(BADGE)) {
    if (eventType.includes(key)) return `${emoji}${eventType}`;
  }
  return `⚪${eventType}`;
}

const MONTHS = [
  { month: 4, label: '4월', mm: '04' },
  { month: 5, label: '5월', mm: '05' },
  { month: 6, label: '6월', mm: '06' },
  { month: 7, label: '7월', mm: '07' },
];

function buildContent(
  label: string,
  events: CalendarEvent[],
  subscriptions: Subscription[],
): string {
  /* merge subscriptions as 청약 events */
  const merged = [
    ...events.map((e) => ({
      date: e.event_date,
      title: e.title,
      type: e.event_type || '기타',
      importance: e.importance || '',
      description: e.description || '',
    })),
    ...subscriptions.map((s) => ({
      date: s.rcept_bgnde,
      title: `${s.house_nm} 청약 접수 (${s.region_nm || ''})`,
      type: '청약',
      importance: '높음',
      description: `접수기간: ${s.rcept_bgnde} ~ ${s.rcept_endde}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  /* group by date */
  const byDate = new Map<string, typeof merged>();
  for (const ev of merged) {
    const d = ev.date?.slice(0, 10) || 'unknown';
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(ev);
  }

  /* calendar grid */
  const calendarRows = [...byDate.entries()]
    .map(([date, evts]) =>
      evts
        .map(
          (ev) =>
            `| ${date} | ${badge(ev.type)} | ${ev.title} | ${ev.importance || '-'} |`,
        )
        .join('\n'),
    )
    .join('\n');

  /* type summary counts */
  const typeCounts: Record<string, number> = {};
  for (const ev of merged) {
    const t = ev.type || '기타';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const typeSummary = Object.entries(typeCounts)
    .map(([t, c]) => `- ${badge(t)}: **${c}건**`)
    .join('\n');

  /* key points */
  const highImportance = merged.filter(
    (e) => e.importance === '높음' || e.importance === 'high',
  );

  return `## 2026년 ${label} 투자 캘린더 개요

2026년 ${label}에 예정된 주요 투자 일정을 한눈에 정리합니다. 실적발표, 청약접수, IPO, 배당락일 등 핵심 이벤트를 놓치지 마세요.

총 **${merged.length}건**의 이벤트가 예정되어 있습니다.

### 유형별 분포

${typeSummary || '- 예정된 이벤트가 없습니다.'}

## 날짜별 일정 캘린더

| 날짜 | 유형 | 이벤트 | 중요도 |
|------|------|--------|--------|
${calendarRows || '| - | - | 해당 월 예정 일정 없음 | - |'}

## 주요 이벤트 하이라이트

${label}에 특히 주목해야 할 이벤트를 정리합니다.

${
  highImportance.length > 0
    ? highImportance
        .slice(0, 8)
        .map((e) => `- **${e.date}** ${badge(e.type)} ${e.title}${e.description ? ` — ${e.description}` : ''}`)
        .join('\n')
    : '- 현재 등록된 고중요도 이벤트가 없습니다. 일정은 지속적으로 업데이트됩니다.'
}

${subscriptions.length > 0 ? `## 청약 접수 일정\n\n${label}에 접수가 시작되는 아파트 청약 일정입니다.\n\n| 단지명 | 지역 | 접수시작 | 접수마감 |\n|--------|------|----------|----------|\n${subscriptions.map((s) => `| ${s.house_nm} | ${s.region_nm || '-'} | ${s.rcept_bgnde} | ${s.rcept_endde} |`).join('\n')}\n\n청약 일정은 변동될 수 있으니 [청약홈](https://www.applyhome.co.kr)에서 최종 확인하시기 바랍니다.` : ''}

## 투자 캘린더 활용 팁

1. **실적발표 시즌**: 실적발표 전후 주가 변동성이 커집니다. 어닝 서프라이즈/쇼크 가능성을 미리 점검하세요.
2. **청약 일정**: 청약 접수일 최소 1주일 전에 자격 요건과 서류를 준비하세요.
3. **IPO**: 공모주 투자 시 수요예측 결과와 공모가 밴드를 확인하세요.
4. **배당락일**: 배당을 받으려면 배당락일 전일까지 주식을 보유해야 합니다.

## 관련 정보

- [아파트 청약 일정 전체 보기](${SITE_URL}/apt/subscriptions)
- [주식 시세 확인](${SITE_URL}/stock)
- [블로그 더 보기](${SITE_URL}/blog)

---

> **면책고지**: 본 콘텐츠는 공공 데이터를 기반으로 정보 제공 목적으로 작성되었으며, 투자 권유가 아닙니다. 일정은 변동될 수 있으니 공식 발표를 반드시 확인하시기 바랍니다.`;
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = parseInt(url.searchParams.get('limit') || '4', 10);

  const admin = getSupabaseAdmin();
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const months = MONTHS.slice(offset, offset + limit);

  for (const m of months) {
    const slug = `invest-calendar-2026-${m.mm}`;
    const title = `2026년 ${m.label} 투자 일정 총정리 \u2014 실적발표\xB7청약접수\xB7IPO\xB7배당락일 캘린더`;

    try {
      const startDate = `2026-${m.mm}-01`;
      const endDate =
        m.month < 12
          ? `2026-${String(m.month + 1).padStart(2, '0')}-01`
          : '2027-01-01';

      /* fetch invest_calendar events */
      const { data: events, error: evErr } = await admin
        .from('invest_calendar')
        .select('id, title, description, event_date, event_type, importance, country')
        .gte('event_date', startDate)
        .lt('event_date', endDate)
        .order('event_date', { ascending: true });

      if (evErr) {
        console.error(`[blog-invest-calendar] event fetch error (${m.mm}):`, evErr.message);
        failed.push(slug);
        continue;
      }

      /* fetch apt_subscriptions starting that month */
      const { data: subs, error: subErr } = await admin
        .from('apt_subscriptions')
        .select('house_nm, region_nm, rcept_bgnde, rcept_endde')
        .gte('rcept_bgnde', startDate)
        .lt('rcept_bgnde', endDate)
        .order('rcept_bgnde', { ascending: true });

      if (subErr) {
        console.error(`[blog-invest-calendar] sub fetch error (${m.mm}):`, subErr.message);
      }

      const eventList = (events || []) as CalendarEvent[];
      const subList = (subs || []) as Subscription[];

      const content = buildContent(m.label, eventList, subList);
      const tags = ['투자일정', '캘린더', m.label, '2026', '실적발표', '청약', 'IPO', '배당'];

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content: ensureMinLength(content, 'stock'),
        excerpt: `2026년 ${m.label} 실적발표, 청약접수, IPO, 배당락일 등 주요 투자 일정을 캘린더 형식으로 정리합니다.`,
        category: 'stock',
        tags,
        cron_type: 'invest-calendar',
        is_published: true,
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&type=blog`,
        image_alt: generateImageAlt('stock', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('stock', tags),
      });

      if (result.success) {
        created.push(slug);
      } else {
        console.warn(`[blog-invest-calendar] skip ${slug}: ${result.reason}`);
        skipped.push(slug);
      }
    } catch (e: any) {
      console.error(`[blog-invest-calendar] error (${slug}):`, e.message);
      failed.push(slug);
    }
  }

  return NextResponse.json({ ok: true, created, skipped, failed });
});
