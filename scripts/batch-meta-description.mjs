#!/usr/bin/env node
/**
 * 세션 146 C1 — Meta description 백필 Batch API 제출 (raw fetch).
 * 실행: node scripts/batch-meta-description.mjs [--submit]
 * 비용 예상 ~$35.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!SERVICE_ROLE || !ANTHROPIC_KEY) { console.error('❌ env missing'); process.exit(1); }

const SUBMIT = process.argv.includes('--submit');
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const PROMPT = (title, excerpt, firstPara) => `제목: ${title}
TLDR: ${excerpt || ''}
첫 문단: ${firstPara || ''}

위 블로그의 meta description 을 80~160자 한국어로 1개 작성하세요.
- 지역명, 핵심 키워드, 연도, 숫자 포함
- 자연문으로, 키워드 나열 금지
- 응답은 JSON 만: {"meta": "..."}`;

async function main() {
  const { data: posts } = await sb
    .from('blog_posts')
    .select('id, title, excerpt, content, meta_description')
    .eq('is_published', true)
    .limit(8000);
  const targets = (posts || []).filter(p => !p.meta_description || p.meta_description.length < 80).slice(0, 2830);
  console.log(`대상: ${targets.length} 편`);

  const requests = targets.map(p => {
    const firstPara = (p.content || '').split('\n\n').find(l => l.trim().length > 50) || '';
    return {
      custom_id: `meta_${p.id}`,
      params: {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: PROMPT(p.title || '', p.excerpt || '', firstPara.slice(0, 400)) }],
      },
    };
  });

  const outPath = path.resolve('scripts', `batch-meta-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ count: requests.length, sample: requests.slice(0, 2) }, null, 2));
  console.log(`preview: ${outPath}`);

  if (!SUBMIT) {
    console.log('--submit 없음 — prepare 만');
    return;
  }

  console.log('Batch 제출 중...');
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
    console.error(`❌ Batch 제출 실패 ${res.status}:`, JSON.stringify(body).slice(0, 500));
    process.exit(1);
  }
  console.log(`batch_id: ${body.id}, status: ${body.processing_status}`);
  await sb.from('blog_batch_jobs').insert({
    batch_id: body.id,
    job_type: 'meta_description',
    status: body.processing_status || 'submitted',
    target_count: targets.length,
  });
}

main().catch(e => { console.error(e); process.exit(1); });
