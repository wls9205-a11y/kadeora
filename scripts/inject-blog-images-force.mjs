#!/usr/bin/env node
/**
 * 세션 154 — 특정 블로그 id 6편 강제 이미지 주입.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const IDS = [86790, 51814, 75676, 70948, 78120, 48914];
const SITE_URL = 'https://kadeora.app';
const TARGET = 5; // 확실히 4장+ 보장

function countImages(md) {
  const a = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  const b = (md.match(/<img\s[^>]*>/gi) || []).length;
  return a + b;
}

function buildImg(title, alt, design) {
  const t = encodeURIComponent(String(title).slice(0, 50));
  return `\n\n![${alt}](${SITE_URL}/api/og?title=${t}&category=apt&design=${design})\n\n`;
}

function allHeaderPositions(md) {
  const out = [];
  const re = /^(#{1,4})\s+.+$/gm;
  for (const m of md.matchAll(re)) out.push(m.index);
  return out;
}

function charBlockPositions(md, count) {
  const out = [];
  const step = Math.floor(md.length / (count + 1));
  for (let i = 1; i <= count; i++) {
    const target = step * i;
    const near = md.indexOf('\n\n', target);
    out.push(near >= 0 ? near : target);
  }
  return out;
}

async function main() {
  const { data: posts } = await sb.from('blog_posts').select('id, title, content, tags').in('id', IDS);
  for (const p of posts || []) {
    const md = p.content || '';
    const existing = countImages(md);
    console.log(`id=${p.id} existing=${existing} len=${md.length}`);
    if (existing >= 4) { console.log('  skip — 이미 4장+'); continue; }

    const needed = TARGET - existing + 1; // 여유 1장
    let positions = allHeaderPositions(md);
    if (positions.length < needed) {
      positions = [...positions, ...charBlockPositions(md, needed - positions.length)].sort((a, b) => a - b);
    }
    positions = positions.slice(0, needed);
    if (positions.length === 0) { console.log('  ⚠ positions 0'); continue; }

    const year = new Date().getFullYear();
    const alt = `${p.tags?.[0] || p.title?.slice(0, 20)} ${year}`.trim();
    const sorted = [...positions].sort((a, b) => b - a);
    let result = md;
    for (let i = 0; i < sorted.length; i++) {
      const design = ((i + existing) % 6) + 1;
      result = result.slice(0, sorted[i]) + buildImg(p.title || '', alt, design) + result.slice(sorted[i]);
    }

    const { error } = await sb.from('blog_posts').update({ content: result }).eq('id', p.id);
    if (error) console.log('  ❌', error.message);
    else console.log(`  ✅ inserted ${sorted.length}, total=${countImages(result)}`);
  }

  console.log('\n검증:');
  const { data: check } = await sb.from('blog_posts').select('id, content').in('id', IDS);
  for (const r of check || []) console.log(`  id=${r.id} imgs=${countImages(r.content || '')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
