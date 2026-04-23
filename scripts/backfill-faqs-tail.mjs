#!/usr/bin/env node
/**
 * 세션 148 B — FAQ 파싱 실패 27편 잔존 처리.
 * 패턴 D: non-H2 헤더 "자주 묻는 질문" + 일반 Q./A. 라인
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function extract(md) {
  const idx = md.search(/##\s*자주\s*묻는\s*질문|(?:^|\n)자주\s*묻는\s*질문\s*\n/);
  if (idx < 0) return [];
  const block = md.slice(idx);
  const end = block.search(/\n##\s|\n---\s*\n/);
  const body = end >= 0 ? block.slice(0, end) : block;

  // 라인 단위로 Q./A. 쌍 찾기
  const lines = body.split('\n');
  const out = [];
  let curQ = null;
  let curA = [];
  const flush = () => {
    if (curQ && curA.length > 0) {
      const a = curA.join(' ').trim().slice(0, 1500);
      if (curQ.length >= 4 && a.length >= 10) out.push({ q: curQ, a, idx: out.length });
    }
    curQ = null; curA = [];
  };
  for (const line of lines) {
    const qm = line.match(/^\s*Q\.?\s*(.+)$/);
    const am = line.match(/^\s*A\.?\s*(.+)$/);
    if (qm) { flush(); curQ = qm[1].trim(); continue; }
    if (am && curQ) { curA.push(am[1].trim()); continue; }
    if (curQ && curA.length > 0 && line.trim()) { curA.push(line.trim()); continue; }
    if (!line.trim() && curA.length > 0) { /* paragraph continues */ }
  }
  flush();
  return out.slice(0, 10);
}

async function main() {
  // pagination — 전체 순회
  const targets = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data: page } = await sb.from('blog_posts')
      .select('id, content, metadata')
      .eq('is_published', true)
      .ilike('content', '%자주 묻는 질문%')
      .order('id', { ascending: true })
      .range(offset, offset + 499);
    if (!page || page.length === 0) break;
    for (const r of page) if (!(r.metadata && r.metadata.faqs)) targets.push(r);
    if (page.length < 500) break;
  }
  console.log(`잔존 대상: ${targets.length}`);
  let ok = 0, fail = 0;
  for (const r of targets) {
    const faqs = extract(r.content || '');
    if (faqs.length === 0) { fail++; continue; }
    const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
    const { error } = await sb.from('blog_posts').update({ metadata: { ...meta, faqs } }).eq('id', r.id);
    if (error) { fail++; continue; }
    ok++;
  }
  console.log(`ok=${ok}, fail=${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
