#!/usr/bin/env node
/**
 * 세션 146 B3 — 블로그 본문에서 FAQ 추출 후 blog_posts.metadata.faqs 에 저장.
 *
 * 실행: node scripts/backfill-faqs.mjs [--limit=500] [--dry]
 *
 * 안전:
 * - metadata.faqs 이미 있는 row 는 재처리 스킵 (--force 로 강제)
 * - 배치 500, 병렬 5 파이프
 * - blog_posts.id 는 bigint (UUID 취급 금지)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(1); }

const args = process.argv.slice(2);
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const Q_HEADER_RE = /^#{2,3}\s*(?:Q\.?\s*|질문\s*[:：]?\s*)(.+?)$/gm;
const FAQ_SECTION_RE = /^#{2,3}\s*(?:자주\s*묻는\s*질문|FAQ|Q\s*&\s*A)\s*$/im;

function parseFaqs(markdown) {
  if (!markdown || markdown.length < 50) return [];
  const faqs = [];
  const qMatches = Array.from(markdown.matchAll(Q_HEADER_RE));
  for (const m of qMatches) {
    const q = (m[1] || '').trim().replace(/^[\s"'"]+|[\s"'"]+$/g, '');
    if (!q || q.length < 4) continue;
    const idx = m.index + m[0].length;
    const rest = markdown.slice(idx);
    const aMatch = rest.match(/^\s*\n+(?:A\.?\s*|답\s*[:：]?\s*)?([\s\S]*?)(?=\n#{2,3}\s|\n---|\n$|$)/);
    const a = aMatch ? aMatch[1].trim().replace(/\n+/g, ' ').slice(0, 800) : '';
    if (a.length >= 10) faqs.push({ q, a });
    if (faqs.length >= 8) break;
  }
  if (faqs.length > 0) return faqs;

  const sectionIdx = markdown.search(FAQ_SECTION_RE);
  if (sectionIdx < 0) return [];
  const section = markdown.slice(sectionIdx);
  const pairRe = /(?:Q\s*[:：.]?\s*|질문\s*[:：]?\s*)(.+?)\n+(?:A\s*[:：.]?\s*|답\s*[:：]?\s*)([\s\S]+?)(?=\n\s*(?:Q\s*[:：.]?|질문\s*[:：]|#{2,3}\s)|\n$|$)/g;
  const pairMatches = Array.from(section.matchAll(pairRe));
  for (const m of pairMatches) {
    const q = (m[1] || '').trim();
    const a = (m[2] || '').trim().replace(/\n+/g, ' ').slice(0, 800);
    if (q.length >= 4 && a.length >= 10) faqs.push({ q, a });
    if (faqs.length >= 8) break;
  }
  return faqs;
}

async function processBatch(rows) {
  const results = await Promise.all(rows.map(async (r) => {
    const md = r.content || '';
    const faqs = parseFaqs(md);
    if (faqs.length === 0) return { id: r.id, skipped: 'no_faqs' };
    const existingMeta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
    const newMeta = { ...existingMeta, faqs };
    if (DRY) return { id: r.id, dry_faqs: faqs.length };
    const { error } = await sb.from('blog_posts').update({ metadata: newMeta }).eq('id', r.id);
    if (error) return { id: r.id, err: error.message };
    return { id: r.id, faqs: faqs.length };
  }));
  return results;
}

async function main() {
  console.log(`🔍 FAQ 백필 시작 — limit=${LIMIT}, dry=${DRY}, force=${FORCE}`);

  let totalProcessed = 0;
  let totalFaqs = 0;
  let totalNoFaq = 0;
  let totalErrors = 0;

  let offset = 0;
  const PAGE = 100;
  while (offset < LIMIT) {
    let q = sb
      .from('blog_posts')
      .select('id, content, metadata')
      .eq('is_published', true)
      .order('view_count', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (!FORCE) {
      // metadata->faqs 없는 row 만 — PostgREST filter: metadata->>faqs IS NULL
      q = q.or('metadata.is.null,metadata->faqs.is.null');
    }
    const { data: rows, error } = await q;
    if (error) { console.error('❌ select 실패:', error.message); break; }
    if (!rows || rows.length === 0) break;

    const results = await processBatch(rows);
    results.forEach((r) => {
      if (r.err) totalErrors++;
      else if (r.skipped) totalNoFaq++;
      else { totalProcessed++; totalFaqs += (r.faqs || r.dry_faqs || 0); }
    });

    console.log(`  offset=${offset} rows=${rows.length} updated=${results.filter(r => r.faqs || r.dry_faqs).length}`);
    offset += PAGE;
    if (rows.length < PAGE) break;
  }

  console.log('\n━━━ 요약 ━━━');
  console.log(`처리: ${totalProcessed}`);
  console.log(`FAQ 총합: ${totalFaqs}`);
  console.log(`FAQ 없음: ${totalNoFaq}`);
  console.log(`에러: ${totalErrors}`);
}

main().catch(e => { console.error('❌ fatal:', e); process.exit(1); });
