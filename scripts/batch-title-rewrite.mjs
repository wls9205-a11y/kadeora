#!/usr/bin/env node
/**
 * 세션 146 C2 — 약한 타이틀 Batch API 제출 (raw fetch).
 * 실행: node scripts/batch-title-rewrite.mjs [--submit]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!SERVICE_ROLE || !ANTHROPIC_KEY) { console.error('❌ env missing'); process.exit(1); }

const SUBMIT = process.argv.includes('--submit');
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const PROMPT = (title, tags, category) => `기존 제목: ${title}
태그: ${(tags || []).join(', ')}
카테고리: ${category}

위 블로그의 타이틀을 30~50자 한국어로 재작성하세요.
- 지역명, 연도, 핵심 키워드, 수식어 포함
- 카더라 스타일 (실용적, 호기심 유발, 숫자 활용)
- 기존 의미 보존
- 응답은 JSON 만: {"title": "..."}`;

async function main() {
  const { data: posts } = await sb
    .from('blog_posts')
    .select('id, title, tags, category')
    .eq('is_published', true)
    .limit(8000);
  const targets = (posts || []).filter(p => (p.title || '').length < 25).slice(0, 1048);
  console.log(`대상: ${targets.length} 편`);

  const requests = targets.map(p => ({
    custom_id: `title_${p.id}`,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: PROMPT(p.title || '', p.tags, p.category || '') }],
    },
  }));
  console.log(`requests: ${requests.length}`);

  if (!SUBMIT) {
    console.log('--submit 없음 — prepare 만');
    return;
  }

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
  if (!res.ok) {
    console.error(`❌ 실패 ${res.status}:`, JSON.stringify(body).slice(0, 500));
    process.exit(1);
  }
  console.log(`batch_id: ${body.id}, status: ${body.processing_status}`);
  await sb.from('blog_batch_jobs').insert({
    batch_id: body.id,
    job_type: 'title_rewrite',
    status: body.processing_status || 'submitted',
    target_count: targets.length,
  });
}

main().catch(e => { console.error(e); process.exit(1); });
