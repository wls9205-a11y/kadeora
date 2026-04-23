#!/usr/bin/env node
/**
 * 세션 147 A2 — FAQ v2 전수 재백필.
 * 실행: node scripts/backfill-faqs-v2.mjs [--limit=8000] [--dry]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(1); }

const args = process.argv.slice(2);
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '8000', 10);
const DRY = args.includes('--dry');

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const FAQ_SECTION_START = /^##\s*(?:❓\s*)?(?:자주\s*묻는\s*질문|FAQ|Q\s*&\s*A)/im;

function findFaqBlock(md) {
  if (!md) return null;
  const h2Match = md.match(FAQ_SECTION_START);
  let startIdx = -1;
  if (h2Match && h2Match.index != null) startIdx = h2Match.index;
  else {
    const emojiIdx = md.search(/^\s*❓\s*자주\s*묻는\s*질문/im);
    if (emojiIdx >= 0) startIdx = emojiIdx;
  }
  if (startIdx < 0) return null;
  const tail = md.slice(startIdx + 20);
  const endRel = tail.search(/\n##\s|\n---\s*\n/);
  const endIdx = endRel >= 0 ? startIdx + 20 + endRel : md.length;
  return md.slice(startIdx, endIdx);
}

function extractPatternA(block) {
  const out = [];
  const re = /^###\s*(?!❓)(?:Q\.?\s*)?([^\n]+)\n+(?:A\.?\s*)?([^\n][\s\S]*?)(?=\n###\s|\n##\s|\n---|\n$|$)/gm;
  for (const m of block.matchAll(re)) {
    const q = (m[1] || '').trim();
    const a = (m[2] || '').trim().replace(/\n+/g, ' ').slice(0, 1500);
    if (q.length >= 4 && a.length >= 10) out.push({ q, a });
    if (out.length >= 12) break;
  }
  return out;
}

function extractPatternB(block) {
  const out = [];
  const re = /^###\s*❓\s*([^\n]+)\n+([^\n][\s\S]*?)(?=\n###\s|\n##\s|\n---|\n$|$)/gm;
  for (const m of block.matchAll(re)) {
    const q = (m[1] || '').trim();
    const a = (m[2] || '').trim().replace(/\n+/g, ' ').slice(0, 1500);
    if (q.length >= 4 && a.length >= 10) out.push({ q, a });
    if (out.length >= 12) break;
  }
  return out;
}

function extractPatternC(block) {
  const out = [];
  const re = /\*\*Q[.:]?\s*([^*]+?)\*\*\s*\n+(?:A[.:]?\s*)?([^\n][\s\S]*?)(?=\n\s*\*\*Q[.:]?|\n###\s|\n##\s|\n---|\n$|$)/g;
  for (const m of block.matchAll(re)) {
    const q = (m[1] || '').trim();
    const a = (m[2] || '').trim().replace(/\n+/g, ' ').slice(0, 1500);
    if (q.length >= 4 && a.length >= 10) out.push({ q, a });
    if (out.length >= 12) break;
  }
  return out;
}

function parseFaqs(md) {
  if (!md || md.length < 80) return [];
  const block = findFaqBlock(md);
  const source = block || md;
  const a = extractPatternA(source);
  const b = extractPatternB(source);
  const c = extractPatternC(source);
  const cands = [a, b, c].filter(x => x.length > 0).sort((x, y) => y.length - x.length);
  if (cands.length === 0) return [];
  return cands[0].slice(0, 10).map((f, i) => ({ ...f, idx: i }));
}

async function main() {
  console.log(`🔍 FAQ v2 재백필 — limit=${LIMIT}, dry=${DRY}`);
  let totalUpdated = 0, totalFaqs = 0, totalNoFaq = 0, totalErr = 0;

  let offset = 0;
  const PAGE = 200;
  while (offset < LIMIT) {
    const { data: rows, error } = await sb
      .from('blog_posts')
      .select('id, content, metadata')
      .eq('is_published', true)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('select 실패:', error.message); break; }
    if (!rows || rows.length === 0) break;

    // 5 parallel batches
    const chunkSize = Math.ceil(rows.length / 5);
    const chunks = [];
    for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));

    const results = await Promise.all(chunks.map(async (chunk) => {
      const subs = [];
      for (const r of chunk) {
        const md = r.content || '';
        const faqs = parseFaqs(md);
        if (faqs.length === 0) { subs.push({ skipped: true }); continue; }
        const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
        const newMeta = { ...meta, faqs };
        if (DRY) { subs.push({ ok: true, faqs: faqs.length }); continue; }
        const { error } = await sb.from('blog_posts').update({ metadata: newMeta }).eq('id', r.id);
        if (error) subs.push({ err: error.message });
        else subs.push({ ok: true, faqs: faqs.length });
      }
      return subs;
    }));

    results.flat().forEach((r) => {
      if (r.err) totalErr++;
      else if (r.skipped) totalNoFaq++;
      else { totalUpdated++; totalFaqs += r.faqs || 0; }
    });

    if (offset % 1000 === 0) {
      console.log(`  offset=${offset} updated=${totalUpdated} errors=${totalErr}`);
    }
    offset += PAGE;
    if (rows.length < PAGE) break;
  }

  console.log('\n━━━ 요약 ━━━');
  console.log(`updated: ${totalUpdated}`);
  console.log(`total FAQs: ${totalFaqs}`);
  console.log(`no_faq: ${totalNoFaq}`);
  console.log(`errors: ${totalErr}`);
}

main().catch(e => { console.error('fatal:', e); process.exit(1); });
