#!/usr/bin/env node
/**
 * 세션 149 B — 잔존 FAQ 미추출 포스트 19편 AI 생성 Batch 제출.
 * Haiku 로 Q/A 3개 생성 후 blog_batch_jobs 에 기록.
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

const PROMPT = (title, excerpt, firstPara) => `블로그 제목: ${title}
TLDR: ${excerpt || ''}
본문 일부: ${firstPara || ''}

위 블로그 내용을 기반으로 한국어 FAQ 3개를 작성하세요.
각 질문은 독자가 실제로 가질 법한 것으로, 답변은 1~3문장.
응답은 JSON: {"faqs": [{"q": "...", "a": "..."}, ...]}`;

async function main() {
  const collected = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data } = await sb.from('blog_posts')
      .select('id, title, excerpt, content, metadata')
      .eq('is_published', true)
      .ilike('content', '%자주 묻는 질문%')
      .order('id', { ascending: true })
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    collected.push(...data);
    if (data.length < 1000) break;
  }
  const targets = collected.filter(p => !(p.metadata && p.metadata.faqs));
  console.log(`잔존 대상: ${targets.length}`);
  if (targets.length === 0) return;

  const requests = targets.map(p => {
    const firstPara = (p.content || '').split('\n\n').find(l => l.trim().length > 50) || '';
    return {
      custom_id: `faqai_${p.id}`,
      params: {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: PROMPT(p.title || '', p.excerpt || '', firstPara.slice(0, 400)) }],
      },
    };
  });

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
  if (!res.ok) { console.error(`❌ ${res.status}`, JSON.stringify(body).slice(0, 300)); process.exit(1); }
  console.log(`batch_id: ${body.id}`);

  await sb.from('blog_batch_jobs').insert({
    batch_id: body.id,
    job_type: 'faq_ai_generate',
    status: body.processing_status || 'submitted',
    target_count: targets.length,
  });
}

main().catch(e => { console.error(e); process.exit(1); });
