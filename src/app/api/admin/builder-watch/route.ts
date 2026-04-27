import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Phase 4 A1: 시공사 자체 사이트 모니터 (manual-trigger / external cron)
// 1차: 한웅건설 (mattian.co.kr) 1곳만. 검증 통과 후 PR per builder로 확장.
// 비용 가드: AI 호출 1회당 ~$0.001, 신규 단지 발견 시 추가 1회 ~$0.005.
// MAX 5건 INSERT per run.

interface BuilderTarget {
  key: string;
  name: string;
  url: string;
  candidateSelectors: string[]; // 후보 셀렉터들 — 사이트별로 다양함
}

const TARGETS: Record<string, BuilderTarget> = {
  hanwoong: {
    key: 'hanwoong',
    name: '한웅건설',
    url: 'https://mattian.co.kr',
    candidateSelectors: [
      'a[href*="project"]',
      'a[href*="apartment"]',
      '.project-list a',
      '.business-list a',
      'h2, h3, .title, .name',
    ],
  },
};

const MAX_AI_CALLS_PER_RUN = 5;
const MAX_INSERTS_PER_RUN = 5;

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣-]/g, '')
    .slice(0, 100);
}

interface CandidateApt {
  text: string;
  href?: string;
}

async function extractCandidates(html: string, target: BuilderTarget): Promise<CandidateApt[]> {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: CandidateApt[] = [];
  for (const sel of target.candidateSelectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      const href = $(el).attr('href') || '';
      if (text.length < 4 || text.length > 80) return;
      // 한글 포함 + 단지명 가능성 단어 (마티안 / MATTIAN / 아파트 / 더 / 디 등)
      if (!/[가-힣]/.test(text)) return;
      if (!/마티안|아파트|단지|MATTIAN|D|디|더/i.test(text)) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ text, href });
      if (out.length >= 20) return false;
    });
    if (out.length >= 20) break;
  }
  return out;
}

async function normalizeApt(text: string, builderName: string): Promise<Record<string, any> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `다음 텍스트에서 ${builderName}의 단지 정보를 추출하세요. 단지명이 명확하지 않으면 null 반환.

텍스트: ${text.slice(0, 200)}

JSON으로만 응답:
{"name":"단지명 또는 null","region":"시도 (서울/부산/...)","sigungu":"시군구","dong":"동","total_units":세대수 또는 null,"lifecycle_hint":"pre_announcement"}`;

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
    const responseText = data?.content?.[0]?.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.name || parsed.name === 'null') return null;
    return parsed;
  } catch (err) {
    console.error('[builder-watch] AI normalize error', err);
    return null;
  }
}

async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const builderKey = url.searchParams.get('builder') || 'hanwoong';
  const target = TARGETS[builderKey];
  if (!target) {
    return NextResponse.json({ ok: true, error: 'unknown builder', available: Object.keys(TARGETS) });
  }

  const stats = {
    builder: target.name,
    url: target.url,
    fetch_ok: false,
    candidates: 0,
    ai_calls: 0,
    inserts: 0,
    duplicates: 0,
    errors: [] as string[],
  };

  try {
    const res = await fetch(target.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 KadeoraBot/1.0 (+https://kadeora.app)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      stats.errors.push(`fetch HTTP ${res.status}`);
      return NextResponse.json({ ok: true, ...stats });
    }
    const html = await res.text();
    stats.fetch_ok = true;

    const candidates = await extractCandidates(html, target);
    stats.candidates = candidates.length;

    if (candidates.length === 0) {
      stats.errors.push('parse_failed: no candidates extracted (selectors may need update)');
      return NextResponse.json({ ok: true, ...stats });
    }

    const admin = getSupabaseAdmin();
    const toNormalize = candidates.slice(0, MAX_AI_CALLS_PER_RUN);
    for (const cand of toNormalize) {
      stats.ai_calls++;
      const info = await normalizeApt(cand.text, target.name);
      if (!info || !info.name) continue;

      const slug = makeSlug(info.name);
      if (!slug || slug.length < 2) continue;

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
        dong: info.dong || null,
        total_units: info.total_units || null,
        builder: target.name,
        is_active: true,
        source_ids: [`builder-watch:${target.key}:${cand.href || target.url}`],
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
    console.error('[builder-watch] error', err);
    stats.errors.push(err?.message ?? String(err));
  }

  return NextResponse.json({ ok: true, ...stats });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
