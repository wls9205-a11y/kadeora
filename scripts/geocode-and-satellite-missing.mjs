#!/usr/bin/env node
/**
 * 세션 145 후속 — 좌표 없는 신규 분양 8건 Kakao geocoding 일회성
 *
 * 실행: node scripts/geocode-and-satellite-missing.mjs
 * DRY_RUN=1 node scripts/geocode-and-satellite-missing.mjs  → UPDATE 없이 로그만
 *
 * satellite_image_url 은 별도: pg_cron apt_satellite_crawl 이 30분 주기로
 * lat/lng 채워진 rows 를 VWorld 타일로 자동 변환 후 Storage 업로드 후 DB UPDATE.
 * 이 스크립트는 lat/lng 만 채우면 끝 (최대 30분 내 satellite 자동 생성).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!SERVICE_ROLE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(1); }
if (!KAKAO_KEY) { console.error('❌ KAKAO_REST_API_KEY missing'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const TARGET_NAMES = [
  'PH159',
  '고덕신도시 아테라 A-63블록 공공분양주택',
  '두산위브더제니스 구미(조합원취소분)',
  '경기광주역 롯데캐슬 시그니처 1단지',
  '동탄 그웬 160 (동탄2 B11BL)',
  '인천가정2지구 B2블록 공공분양주택(후속사업)',
  '용인 고림 동문 디 이스트',
  '옥정중앙역 대방 디에트르(중상1, 복합1BL)',
];

/** 주소 꼬리 정리 */
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

/** 동/읍/면/리 + 번지까지만 남김 */
function bareAddress(addr) {
  const c = cleanAddress(addr);
  const m = c.match(/^(.+?(?:동|읍|면|리))\s*(?:산)?\s*([\d-]+)\s*번지?/);
  if (m) return `${m[1]} ${m[2]}`;
  return c.replace(/번지.*$/, '').trim();
}

/** address → Kakao Local API 로 lat/lng 조회. */
async function geocode(address, name) {
  const queries = Array.from(new Set([
    address,
    cleanAddress(address),
    bareAddress(address),
    cleanAddress(address).split(' ').slice(0, 4).join(' '),
    name,
  ].filter(Boolean)));

  let lastStatus = 0;
  for (const q of queries) {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}&size=1`;
      const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
        signal: AbortSignal.timeout(8000),
      });
      lastStatus = res.status;
      if (!res.ok) continue;
      const body = await res.json();
      const doc = body?.documents?.[0];
      if (doc?.x && doc?.y) {
        return { lng: parseFloat(doc.x), lat: parseFloat(doc.y), matched_query: q };
      }
    } catch (e) {
      // next query
    }
    await new Promise(r => setTimeout(r, 250));
  }
  if (lastStatus && lastStatus !== 200) console.log(`     (address API last HTTP ${lastStatus})`);

  // address 실패 시 keyword search 로 다시 시도 (장소명 매칭)
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(name)}&size=1`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const body = await res.json();
      const doc = body?.documents?.[0];
      if (doc?.x && doc?.y) {
        return { lng: parseFloat(doc.x), lat: parseFloat(doc.y), matched_query: `keyword:${name}` };
      }
    }
  } catch {}

  return null;
}

async function main() {
  console.log(`🎯 좌표 보강 대상 ${TARGET_NAMES.length}건 조회\n${DRY_RUN ? '(DRY_RUN — UPDATE 생략)\n' : ''}`);

  const { data: sites, error } = await sb
    .from('apt_sites')
    .select('id, name, address, latitude, longitude')
    .in('name', TARGET_NAMES);

  if (error) { console.error('DB select 실패:', error.message); process.exit(1); }

  const stats = { total: sites.length, geocoded: 0, updated: 0, failed: 0, already: 0 };
  const failures = [];

  for (const site of sites) {
    const tag = site.name.slice(0, 30);
    if (site.latitude && site.longitude) {
      console.log(`⏭  ${tag} — 이미 좌표 있음`);
      stats.already++;
      continue;
    }
    if (!site.address) {
      console.log(`❌ ${tag} — address 없음`);
      stats.failed++;
      failures.push({ name: site.name, reason: 'no_address' });
      continue;
    }

    const coords = await geocode(site.address, site.name);
    if (!coords) {
      console.log(`❌ ${tag} — geocoding 실패`);
      stats.failed++;
      failures.push({ name: site.name, reason: 'geocode_failed', address: site.address });
      continue;
    }

    stats.geocoded++;
    console.log(`✅ ${tag} → ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (via "${coords.matched_query.slice(0, 50)}")`);

    if (!DRY_RUN) {
      const { error: upErr } = await sb
        .from('apt_sites')
        .update({ latitude: coords.lat, longitude: coords.lng, updated_at: new Date().toISOString() })
        .eq('id', site.id);
      if (upErr) {
        console.log(`   ⚠ UPDATE 실패: ${upErr.message}`);
        stats.failed++;
        failures.push({ name: site.name, reason: 'update_failed', err: upErr.message });
      } else {
        stats.updated++;
      }
    }

    await new Promise(r => setTimeout(r, 350)); // rate limit 보호
  }

  console.log('\n━━━ 요약 ━━━');
  console.log(`총 대상: ${stats.total}`);
  console.log(`이미 좌표: ${stats.already}`);
  console.log(`geocoding 성공: ${stats.geocoded}`);
  console.log(`DB UPDATE: ${stats.updated}${DRY_RUN ? ' (DRY_RUN)' : ''}`);
  console.log(`실패: ${stats.failed}`);
  if (failures.length) {
    console.log('\n실패 상세:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.reason}${f.address ? ' | ' + f.address : ''}`));
  }
  console.log('\n💡 이후: pg_cron apt_satellite_crawl 이 30분 주기로 대기 큐에서 자동 satellite 생성.');
}

main().catch(e => { console.error('❌ fatal:', e); process.exit(1); });
