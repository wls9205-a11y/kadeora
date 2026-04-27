#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SW_PATH = join(process.cwd(), 'public', 'sw.js');

function pickVersion() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 8);
  const explicit = process.env.NEXT_PUBLIC_CACHE_VERSION;
  if (explicit) return explicit;
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function main() {
  if (!existsSync(SW_PATH)) {
    console.warn('[inject-sw-version] public/sw.js not found, skipping');
    return;
  }
  const version = pickVersion();
  const original = readFileSync(SW_PATH, 'utf8');
  const next = original.replace(
    /const\s+CACHE_VERSION\s*=\s*['"][^'"]*['"]\s*;/,
    `const CACHE_VERSION = '${version}';`
  );
  if (next === original) {
    console.warn('[inject-sw-version] CACHE_VERSION literal not found, skipping');
    return;
  }
  writeFileSync(SW_PATH, next, 'utf8');
  console.log(`[inject-sw-version] CACHE_VERSION = ${version}`);
}

main();
