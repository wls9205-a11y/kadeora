#!/usr/bin/env node
/**
 * 세션 152 — 블로그 본문 이미지 4장+ 전수 보강.
 * 네이버 이미지 캐러셀 진입 조건 (본문 이미지 4장+) 즉시 달성.
 *
 * 실행: node scripts/inject-blog-images.mjs [--limit=8000] [--dry]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
if (!SERVICE_ROLE) { console.error('env missing'); process.exit(1); }

const args = process.argv.slice(2);
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '8000', 10);
const DRY = args.includes('--dry');

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const TARGET_MIN = 4;
const TARGET_MAX = 6;

function countImages(md) {
  if (!md) return 0;
  const mdImgs = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  const htmlImgs = (md.match(/<img\s[^>]*>/gi) || []).length;
  return mdImgs + htmlImgs;
}

function buildImgMd(title, alt, design, category) {
  const t = encodeURIComponent(String(title).slice(0, 50));
  const c = category || 'blog';
  return `\n\n![${alt}](${SITE_URL}/api/og?title=${t}&category=${c}&design=${design})\n\n`;
}

function headerPositions(md) {
  const arr = [];
  const re = /^(#{2,3})\s+.+$/gm;
  for (const m of md.matchAll(re)) arr.push({ pos: m.index, level: m[1].length });
  arr.sort((a, b) => a.level - b.level || a.pos - b.pos);
  return arr.map(a => a.pos);
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

function injectImages(post) {
  const md = post.content || '';
  if (md.length < 200) return null;
  const existing = countImages(md);
  if (existing >= TARGET_MIN) return null;

  const needed = Math.min(TARGET_MAX - existing, TARGET_MIN - existing + 2);
  if (needed <= 0) return null;

  let positions = headerPositions(md);
  if (positions.length < needed) {
    const blocks = charBlockPositions(md, needed - positions.length);
    positions = [...positions, ...blocks].sort((a, b) => a - b);
  }
  positions = positions.slice(0, needed);
  if (positions.length === 0) return null;

  const year = new Date().getFullYear();
  const firstTag = (post.tags && post.tags[0]) || String(post.title || '').slice(0, 20);
  const region = post.tags?.find(t => /시$|도$|군$|구$/.test(t)) || '';
  const alt = `${region} ${firstTag} ${year}`.trim().slice(0, 120);

  const sorted = [...positions].sort((a, b) => b - a);
  let result = md;
  for (let i = 0; i < sorted.length; i++) {
    const design = ((i + existing) % 6) + 1;
    result = result.slice(0, sorted[i]) + buildImgMd(post.title || '', alt, design, post.category || 'blog') + result.slice(sorted[i]);
  }
  return { markdown: result, inserted: sorted.length, totalImages: existing + sorted.length };
}

async function main() {
  console.log(`블로그 이미지 보강 시작 limit=${LIMIT} dry=${DRY}`);
  let processed = 0, updated = 0, skipped = 0, errors = 0, totalIns = 0;
  const distro = { 0: 0, 1: 0, 2: 0, 3: 0, '4plus': 0 };

  for (let offset = 0; offset < LIMIT; offset += 500) {
    const { data: page, error } = await sb
      .from('blog_posts')
      .select('id, title, content, category, tags, view_count')
      .eq('is_published', true)
      .gte('content_length', 800)
      .order('view_count', { ascending: false })
      .range(offset, offset + 499);
    if (error) { console.error('select err:', error.message); break; }
    if (!page || page.length === 0) break;

    for (const p of page) {
      processed++;
      const cnt = countImages(p.content || '');
      if (cnt >= 4) distro['4plus']++; else distro[cnt] = (distro[cnt] || 0) + 1;
      if (cnt >= 4) continue;

      const r = injectImages(p);
      if (!r) { skipped++; continue; }
      if (DRY) { updated++; totalIns += r.inserted; continue; }

      const { error: uerr } = await sb.from('blog_posts').update({ content: r.markdown }).eq('id', p.id);
      if (uerr) errors++;
      else { updated++; totalIns += r.inserted; }
    }
    if (offset % 1000 === 0 && offset > 0) {
      console.log(`  offset=${offset} processed=${processed} updated=${updated}`);
    }
    if (page.length < 500) break;
  }

  console.log('\n━━ 요약 ━━');
  console.log('processed:', processed);
  console.log('updated:', updated);
  console.log('skipped:', skipped);
  console.log('errors:', errors);
  console.log('inserted images total:', totalIns);
  console.log('분포 (기존):', distro);
}

main().catch(e => { console.error('fatal:', e); process.exit(1); });
