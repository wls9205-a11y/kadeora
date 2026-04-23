#!/usr/bin/env node
/**
 * 세션 147 B2 — Title 재제출 v2. metadata.title_batch_submitted 마킹.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!SERVICE_ROLE || !ANTHROPIC_KEY) { console.error('env missing'); process.exit(1); }

const SUBMIT = process.argv.includes('--submit');
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const PROMPT = (title, tags, category) => `기존 제목: ${title}
태그: ${(tags || []).join(', ')}
카테고리: ${category}

타이틀을 30~50자 한국어로 재작성.
- 지역·연도·키워드·수식어
- 카더라 스타일 (실용, 호기심, 숫자)
- 기존 의미 보존
- JSON: {"title": "..."}`;

async function main() {
  const collected = [];
  for (let offset = 0; offset < 12000; offset += 1000) {
    const { data: page } = await sb
      .from('blog_posts')
      .select('id, title, tags, category, metadata')
      .eq('is_published', true)
      .order('id', { ascending: true })
      .range(offset, offset + 999);
    if (!page || page.length === 0) break;
    collected.push(...page);
    if (page.length < 1000) break;
  }
  const targets = collected.filter(p =>
    (p.title || '').length < 25 &&
    !(p.metadata && typeof p.metadata === 'object' && p.metadata.title_batch_submitted === true)
  );
  console.log(`대상: ${targets.length}`);
  if (targets.length === 0) return;

  const requests = targets.map(p => ({
    custom_id: `title_${p.id}`,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: PROMPT(p.title || '', p.tags, p.category || '') }],
    },
  }));

  if (!SUBMIT) { console.log('--submit 없음'); return; }

  const res = await fetch('https://api.anthropic.com/v1/messages/batches', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  const body = await res.json();
  if (!res.ok) { console.error(`❌ ${res.status}`, JSON.stringify(body).slice(0, 400)); process.exit(1); }
  console.log(`batch_id: ${body.id}`);

  await sb.from('blog_batch_jobs').insert({
    batch_id: body.id, job_type: 'title_rewrite', status: body.processing_status || 'submitted',
    target_count: targets.length,
  });

  const ids = targets.map(p => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: existing } = await sb.from('blog_posts').select('id, metadata').in('id', chunk);
    await Promise.all((existing || []).map(r => {
      const newMeta = { ...(r.metadata && typeof r.metadata === 'object' ? r.metadata : {}), title_batch_submitted: true, title_batch_id: body.id };
      return sb.from('blog_posts').update({ metadata: newMeta }).eq('id', r.id);
    }));
  }
  console.log(`마킹 완료: ${ids.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
