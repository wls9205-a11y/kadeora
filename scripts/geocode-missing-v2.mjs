#!/usr/bin/env node
/**
 * 세션 147 D3 — 좌표 없는 분양 8건 Nominatim 기반 재실행.
 * Kakao 권한 차단 상태 + VWorld/Naver Cloud 로컬 env 없음 → OSM Nominatim 사용.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function cleanAddress(addr) {
  return addr
    .replace(/특례시/g, '시')
    .replace(/\([^)]*\)/g, '')
    .replace(/외\s*\d+\s*필지.*$/, '')
    .replace(/\s*일원\s*.*$/, '')
    .replace(/\s*지구.*$/, '')
    .replace(/,.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function nominatim(query) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ko`, {
      headers: { 'User-Agent': 'kadeora-geocode/1.0 (kadeora.app@gmail.com)' },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const d = Array.isArray(body) ? body[0] : null;
    if (d?.lat && d?.lon) return { lat: parseFloat(d.lat), lng: parseFloat(d.lon) };
  } catch {}
  return null;
}

const TARGETS = [
  'PH159',
  '고덕신도시 아테라 A-63블록 공공분양주택',
  '두산위브더제니스 구미(조합원취소분)',
  '경기광주역 롯데캐슬 시그니처 1단지',
  '동탄 그웬 160 (동탄2 B11BL)',
  '인천가정2지구 B2블록 공공분양주택(후속사업)',
  '용인 고림 동문 디 이스트',
  '옥정중앙역 대방 디에트르(중상1, 복합1BL)',
];

async function main() {
  const { data: sites } = await sb
    .from('apt_sites')
    .select('id, name, address, latitude, longitude')
    .in('name', TARGETS);

  let success = 0, failed = 0;
  for (const s of sites) {
    if (s.latitude && s.longitude) { console.log(`⏭  ${s.name} 이미 좌표 있음`); continue; }
    const queries = Array.from(new Set([
      cleanAddress(s.address || ''),
      cleanAddress(s.address || '').split(' ').slice(0, 4).join(' '),
    ].filter(Boolean)));

    let coord = null;
    for (const q of queries) {
      coord = await nominatim(q);
      if (coord) { console.log(`✅ ${s.name} → ${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)} (via "${q}")`); break; }
      await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
    }
    if (!coord) { console.log(`❌ ${s.name} geocode 실패`); failed++; continue; }

    const { error } = await sb.from('apt_sites').update({ latitude: coord.lat, longitude: coord.lng, updated_at: new Date().toISOString() }).eq('id', s.id);
    if (error) { console.log(`⚠ update err: ${error.message}`); failed++; } else { success++; }
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`\n완료: ${success}/${sites.length} 성공, ${failed} 실패`);
  console.log('pg_cron apt_satellite_crawl 이 다음 tick 에 자동 satellite 생성.');
}

main().catch(e => { console.error(e); process.exit(1); });
