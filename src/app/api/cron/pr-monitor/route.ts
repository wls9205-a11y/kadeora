import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Phase 4 A2: 부동산 PR 모니터 cron
// - 5개 RSS fetch (RSS는 fast-xml-parser 없이 정규식 파싱)
// - 키워드 필터: 분양 관련 6개 + 본문 내 단지명 추출
// - claude-haiku 1회 호출로 단지 정보 정규화 (비용 가드: 매치 N건당 N회 호출, MAX 5건)
// - apt_sites slug 충돌 체크 후 신규 INSERT (lifecycle_stage='pre_announcement', site_type='subscription')
// - 항상 200 반환 (cron 핸들러 규칙)

const RSS_FEEDS: Array<{ name: string; url: string }> = [
  { name: 'heraldcorp_biz', url: 'https://biz.heraldcorp.com/rss/all.xml' },
  { name: 'sedaily_realestate', url: 'https://www.sedaily.com/RSS/RealEstate.xml' },
];

const KEYWORDS = ['분양 예정', '공급 예정', '모델하우스 오픈', '청약 일정', '5월 분양', '6월 분양', '7월 분양', '분양가', '입주자 모집'];

const MAX_AI_CALLS_PER_RUN = 5;
const MAX_INSERTS_PER_RUN = 5;

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string): string => {
      const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i');
      const m = block.match(re);
      return (m?.[1] ?? '').replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
    };
    items.push({
      title: get('title'),
      link: get('link'),
      description: get('description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      pubDate: get('pubDate'),
    });
    if (items.length >= 50) break;
  }
  return items;
}

function matchesKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣-]/g, '')
    .slice(0, 100);
}

async function extractAptInfo(article: RssItem): Promise<Record<string, any> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `다음 부동산 뉴스 기사에서 단지 정보를 추출하세요. 단지명이 명확하지 않으면 null 반환.

제목: ${article.title}
설명: ${article.description.slice(0, 500)}

JSON으로만 응답:
{"name":"단지명 또는 null","region":"시도 (서울/부산/...)","sigungu":"시군구","total_units":세대수 또는 null,"builder":"시공사 또는 null","lifecycle_hint":"pre_announcement 또는 model_house_open"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.name || parsed.name === 'null') return null;
    return parsed;
  } catch (err) {
    console.error('[pr-monitor] AI extract error', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = {
    feeds_attempted: 0,
    feeds_ok: 0,
    items_total: 0,
    items_matched: 0,
    ai_calls: 0,
    inserts: 0,
    duplicates: 0,
    errors: [] as string[],
  };

  try {
    const admin = getSupabaseAdmin();
    const matchedItems: RssItem[] = [];

    for (const feed of RSS_FEEDS) {
      stats.feeds_attempted++;
      try {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 KadeoraBot/1.0 (+https://kadeora.app)' },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          stats.errors.push(`${feed.name}: HTTP ${res.status}`);
          continue;
        }
        const xml = await res.text();
        stats.feeds_ok++;
        const items = parseRss(xml);
        stats.items_total += items.length;
        for (const item of items) {
          if (matchesKeyword(item.title + ' ' + item.description)) {
            stats.items_matched++;
            matchedItems.push(item);
          }
        }
      } catch (err: any) {
        stats.errors.push(`${feed.name}: ${err?.message ?? String(err)}`);
      }
    }

    // 비용 가드: AI 호출 MAX_AI_CALLS_PER_RUN
    const toExtract = matchedItems.slice(0, MAX_AI_CALLS_PER_RUN);
    for (const item of toExtract) {
      stats.ai_calls++;
      const info = await extractAptInfo(item);
      if (!info || !info.name) continue;

      const slug = makeSlug(info.name);
      if (!slug || slug.length < 2) continue;

      // 슬러그 충돌 체크
      const { data: existing } = await (admin as any).from('apt_sites')
        .select('id').eq('slug', slug).maybeSingle();
      if (existing) {
        stats.duplicates++;
        continue;
      }

      if (stats.inserts >= MAX_INSERTS_PER_RUN) break;

      const { error: insertErr } = await (admin as any).from('apt_sites').insert({
        slug,
        name: info.name.trim().slice(0, 200),
        site_type: 'subscription',
        status: 'active',
        lifecycle_stage: info.lifecycle_hint || 'pre_announcement',
        region: info.region || null,
        sigungu: info.sigungu || null,
        total_units: info.total_units || null,
        builder: info.builder || null,
        is_active: true,
        source_ids: [`pr-monitor:${item.link}`],
        og_cards: [
          { idx: 1, type: 'cover', url: `/api/og-apt?slug=${slug}&card=1&v=1`, alt: `${info.name} 단지 정보` },
          { idx: 2, type: 'metric', url: `/api/og-apt?slug=${slug}&card=2&v=1`, alt: `${info.name} 분양가` },
          { idx: 3, type: 'units', url: `/api/og-apt?slug=${slug}&card=3&v=1`, alt: `${info.name} 평형구성` },
          { idx: 4, type: 'timing', url: `/api/og-apt?slug=${slug}&card=4&v=1`, alt: `${info.name} 청약일정` },
          { idx: 5, type: 'place', url: `/api/og-apt?slug=${slug}&card=5&v=1`, alt: `${info.name} 입지` },
          { idx: 6, type: 'spec', url: `/api/og-apt?slug=${slug}&card=6&v=1`, alt: `${info.name} 단지 스펙` },
        ],
        cards_generated_at: new Date().toISOString(),
        cards_version: 1,
      });
      if (insertErr) {
        stats.errors.push(`insert ${slug}: ${insertErr.message}`);
      } else {
        stats.inserts++;
      }
    }
  } catch (err: any) {
    console.error('[pr-monitor] error', err);
    stats.errors.push(err?.message ?? String(err));
  }

  return NextResponse.json({ ok: true, ...stats });
}
