#!/usr/bin/env node
/**
 * 세션 155 — GSC refresh_token 직접 테스트.
 * oauth_tokens 행 읽어서 Google token endpoint 호출 → 응답 전체 출력.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const { data, error } = await sb
    .from('oauth_tokens')
    .select('*')
    .eq('provider', 'gsc')
    .maybeSingle();
  if (error) { console.error('DB err:', error.message); process.exit(1); }
  if (!data) { console.log('❌ oauth_tokens row for provider=gsc 없음'); process.exit(1); }

  console.log('━━ oauth_tokens row ━━');
  console.log('provider:', data.provider);
  console.log('refresh_token:', data.refresh_token ? `SET(${data.refresh_token.length}c, prefix=${data.refresh_token.slice(0,6)}..)` : 'NULL');
  console.log('access_token:', data.access_token ? `SET(${data.access_token.length}c)` : 'NULL');
  console.log('access_token_expires_at:', data.access_token_expires_at);
  console.log('client_id:', data.client_id ? `SET(${data.client_id.length}c, prefix=${data.client_id.slice(0,12)}..)` : 'NULL');
  console.log('client_secret:', data.client_secret ? `SET(${data.client_secret.length}c)` : 'NULL');
  console.log('refresh_count:', data.refresh_count);
  console.log('last_refreshed_at:', data.last_refreshed_at);
  console.log('last_error:', data.last_error);
  console.log('metadata:', JSON.stringify(data.metadata).slice(0, 300));

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || data.client_id;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || data.client_secret;
  if (!clientId || !clientSecret || !data.refresh_token) {
    console.log('\n❌ creds 불완전 — refresh 시도 불가');
    process.exit(1);
  }

  console.log('\n━━ Google token endpoint 호출 ━━');
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: data.refresh_token,
    grant_type: 'refresh_token',
  }).toString();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  console.log('HTTP:', res.status);
  const txt = await res.text();
  console.log('Response:', txt.slice(0, 1500));

  if (res.ok) {
    const j = JSON.parse(txt);
    console.log('\n✅ 새 access_token 발급 성공');
    console.log('expires_in:', j.expires_in);
    console.log('scope:', j.scope);
    console.log('→ refresh_token 유효. Route 로직 재점검 필요 (CASE A)');
  } else {
    console.log('\n❌ refresh_token 거부 — CASE B (Node 수동 재인증 필요)');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
