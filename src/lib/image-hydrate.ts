/**
 * [CI-v1 Task 3] image-hydrate — 외부 hotlink 이미지를 Supabase Storage(images bucket)로 내재화
 *
 * 파이프라인:
 *   fetch remote URL (size/MIME 가드)
 *   → sharp: resize(maxWidth/maxHeight) + webp(quality) 변환
 *   → SHA-256 content hash → 경로 생성 (idempotent)
 *   → storage.upload('images', path, buffer, { upsert:false })
 *   → publicUrl 반환
 *
 * 반환 규약:
 *   { ok:true,  url, storagePath, width, height, bytes, format, hash, source_url }
 *   { ok:false, reason, detail?, source_url }
 *
 * reason enum (상위 cron 에서 집계용):
 *   'invalid_url'         — URL 파싱 실패
 *   'already_storage'     — 이미 우리 Storage 호스트 (재-hydrate 방지)
 *   'domain_blocked'      — 블랙리스트 도메인
 *   'fetch_failed'        — 네트워크 / 타임아웃 / 4xx/5xx
 *   'mime_rejected'       — image/* 아님
 *   'too_large'           — 원본 또는 변환 후 5MB 초과
 *   'decode_failed'       — sharp 처리 중 throw
 *   'upload_failed'       — Storage upload 실패
 *   'duplicate'           — 동일 hash 가 이미 Storage 에 있음 (fast-path: 기존 public URL 리턴)
 *
 * 사용처:
 *   blog-generate-images / apt-image-crawl / stock-image-crawl / big-event-news-attach 등
 *   Naver/Daum 검색 결과 hotlink 를 영구 보존 용도로 변환.
 */

import crypto from 'node:crypto';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';

const STORAGE_BUCKET = 'images';
const BUCKET_BYTE_LIMIT = 5 * 1024 * 1024; // 5 MB (bucket 정책과 동일)

const DEFAULT_HOST = 'https://kadeora.app';
const PUBLIC_URL_HOSTS = [
  // Supabase Storage public URL 은 프로젝트 호스트에 종속
  'supabase.co',
  'supabase.in',
];

// hotlink 거부 대상 (블로그 이미지 파이프와 동일 블랙리스트)
const IMG_BLOCK_HOSTS = [
  'utoimage', 'freepik', 'shutterstock', 'pixabay', 'unsplash', 'istockphoto',
  'namu.wiki', 'wikipedia', 'youtube.com', 'pinimg.com', 'ohousecdn',
  'hogangnono', 'new.land.naver.com', 'landthumb', 'kbland', 'kbstar.com',
  'zigbang', 'dabang', 'dcinside', 'ruliweb.com', 'ppomppu.co.kr',
];

export interface HydrateOptions {
  /** 최대 가로(px). 초과 시 비율 유지하며 축소. 기본 1200 */
  maxWidth?: number;
  /** 최대 세로(px). 기본 800 */
  maxHeight?: number;
  /** webp quality 0-100. 기본 82 */
  quality?: number;
  /** 원본 fetch 타임아웃(ms). 기본 8000 */
  fetchTimeoutMs?: number;
  /** Storage 하위 서브디렉토리 (ex: 'blog', 'apt', 'stock'). 기본 'hydrated' */
  subdir?: string;
  /** 추가 블록 도메인 */
  extraBlockHosts?: string[];
  /** true 면 duplicate 감지 시에도 기존 URL 반환 대신 재-업로드 시도 (기본 false — idempotent) */
  forceReupload?: boolean;
}

export type HydrateResult =
  | {
      ok: true;
      url: string;
      storagePath: string;
      width: number;
      height: number;
      bytes: number;
      format: 'webp';
      hash: string;
      source_url: string;
      duplicate: boolean;
    }
  | {
      ok: false;
      reason:
        | 'invalid_url'
        | 'already_storage'
        | 'domain_blocked'
        | 'fetch_failed'
        | 'mime_rejected'
        | 'too_large'
        | 'decode_failed'
        | 'upload_failed';
      detail?: string;
      source_url: string;
    };

function sha256Hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function parseUrlSafe(input: string): URL | null {
  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function isStorageUrl(u: URL, supabaseUrlEnv: string | undefined): boolean {
  if (supabaseUrlEnv) {
    try {
      const myHost = new URL(supabaseUrlEnv).host;
      if (u.host === myHost) return true;
    } catch { /* ignore */ }
  }
  return PUBLIC_URL_HOSTS.some((h) => u.host.endsWith(h));
}

function isBlocked(u: URL, extras: string[] = []): boolean {
  const host = u.host.toLowerCase();
  const all = [...IMG_BLOCK_HOSTS, ...extras].map((s) => s.toLowerCase());
  return all.some((frag) => host.includes(frag));
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        // 일부 이미지 호스트가 Referer/UA 체크 → 브라우저 유사 UA 지정
        'User-Agent': 'Mozilla/5.0 (compatible; KadeoraImageHydrate/1.0; +https://kadeora.app)',
        Accept: 'image/webp,image/avif,image/jpeg,image/png,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Storage 에 동일 hash 파일이 이미 있는지 조회. 있으면 public URL 리턴.
 * list() 는 prefix 범위 내 최대 100개만 스캔하므로 경로 구성 시 해시 앞 2자리로 분산.
 */
async function findExisting(
  admin: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(storagePath.substring(0, storagePath.lastIndexOf('/')), {
      search: storagePath.substring(storagePath.lastIndexOf('/') + 1),
      limit: 1,
    });
  if (error || !data || data.length === 0) return null;
  const match = data.find(
    (f) => f.name === storagePath.substring(storagePath.lastIndexOf('/') + 1),
  );
  if (!match) return null;
  const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return pub?.publicUrl || null;
}

/**
 * 주어진 URL 의 이미지를 Storage 에 내재화.
 *
 * @param admin Supabase service-role client (storage.from 호출용)
 * @param sourceUrl 원본 이미지 URL
 * @param opts 변환/저장 옵션
 */
export async function hydrateImage(
  admin: SupabaseClient,
  sourceUrl: string,
  opts: HydrateOptions = {},
): Promise<HydrateResult> {
  const parsed = parseUrlSafe(sourceUrl);
  if (!parsed) return { ok: false, reason: 'invalid_url', source_url: sourceUrl };

  const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;

  if (isStorageUrl(parsed, supabaseUrlEnv)) {
    return { ok: false, reason: 'already_storage', source_url: sourceUrl };
  }
  if (isBlocked(parsed, opts.extraBlockHosts)) {
    return { ok: false, reason: 'domain_blocked', source_url: sourceUrl };
  }

  // 1) fetch
  let res: Response;
  try {
    res = await fetchWithTimeout(sourceUrl, opts.fetchTimeoutMs ?? 8000);
  } catch (e: any) {
    return { ok: false, reason: 'fetch_failed', detail: e?.message || 'abort', source_url: sourceUrl };
  }
  if (!res.ok) {
    return { ok: false, reason: 'fetch_failed', detail: `HTTP ${res.status}`, source_url: sourceUrl };
  }

  const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('image/')) {
    return { ok: false, reason: 'mime_rejected', detail: mime, source_url: sourceUrl };
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength && contentLength > BUCKET_BYTE_LIMIT * 2) {
    // 변환 전 원본이 10MB 넘으면 거부 (데이터 낭비 방지)
    return {
      ok: false,
      reason: 'too_large',
      detail: `source ${contentLength}B`,
      source_url: sourceUrl,
    };
  }

  const inputBuf: Buffer = Buffer.from(await res.arrayBuffer());

  // 2) sharp 변환
  const maxWidth = opts.maxWidth ?? 1200;
  const maxHeight = opts.maxHeight ?? 800;
  const quality = opts.quality ?? 82;

  let outBuf: Buffer;
  let width = 0;
  let height = 0;

  try {
    const pipeline = sharp(inputBuf, { failOn: 'none' })
      .rotate() // EXIF auto-orient
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    outBuf = data;
    width = info.width;
    height = info.height;
  } catch (e: any) {
    return { ok: false, reason: 'decode_failed', detail: e?.message || 'sharp', source_url: sourceUrl };
  }

  if (outBuf.length > BUCKET_BYTE_LIMIT) {
    // 5MB 넘으면 quality 낮춰 재시도 1회
    try {
      const retryQuality = Math.max(40, quality - 20);
      const { data } = await sharp(inputBuf, { failOn: 'none' })
        .rotate()
        .resize({ width: Math.min(maxWidth, 1000), height: maxHeight, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: retryQuality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (data.length > BUCKET_BYTE_LIMIT) {
        return { ok: false, reason: 'too_large', detail: `retry ${data.length}B`, source_url: sourceUrl };
      }
      outBuf = data;
    } catch (e: any) {
      return { ok: false, reason: 'decode_failed', detail: `retry ${e?.message || ''}`, source_url: sourceUrl };
    }
  }

  // 3) 경로 생성 — content hash 기반 → idempotent
  const hash = sha256Hex(outBuf);
  const subdir = (opts.subdir || 'hydrated').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'hydrated';
  // 앞 2자리로 디렉토리 분산 (1,024 파일당 1 폴더 목표, 단순 16진 분산)
  const fan = hash.substring(0, 2);
  const storagePath = `${subdir}/${fan}/${hash}.webp`;

  // 4) 이미 동일 hash 있으면 fast-path (idempotent upload)
  if (!opts.forceReupload) {
    const existing = await findExisting(admin, storagePath);
    if (existing) {
      return {
        ok: true,
        url: existing,
        storagePath,
        width,
        height,
        bytes: outBuf.length,
        format: 'webp',
        hash,
        source_url: sourceUrl,
        duplicate: true,
      };
    }
  }

  // 5) upload
  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, outBuf, {
      contentType: 'image/webp',
      upsert: !!opts.forceReupload, // 기본 false: 동일 경로 있으면 실패 → 위 fast-path 에서 잡힘
      cacheControl: 'public, max-age=31536000, immutable',
    });

  if (upErr) {
    // race: 다른 러너가 먼저 업로드했을 수 있음 → 409 / "duplicate" 는 success 처리
    const msg = upErr.message || '';
    if (/duplicate|already exists|resource already exists/i.test(msg)) {
      const existingUrl = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
      return {
        ok: true,
        url: existingUrl || '',
        storagePath,
        width,
        height,
        bytes: outBuf.length,
        format: 'webp',
        hash,
        source_url: sourceUrl,
        duplicate: true,
      };
    }
    return { ok: false, reason: 'upload_failed', detail: msg, source_url: sourceUrl };
  }

  const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  const publicUrl = pub?.publicUrl || `${DEFAULT_HOST}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;

  return {
    ok: true,
    url: publicUrl,
    storagePath,
    width,
    height,
    bytes: outBuf.length,
    format: 'webp',
    hash,
    source_url: sourceUrl,
    duplicate: false,
  };
}

/**
 * 여러 URL 동시 hydrate. concurrency 제한 + 부분 성공 보장.
 */
export async function hydrateImages(
  admin: SupabaseClient,
  urls: string[],
  opts: HydrateOptions & { concurrency?: number } = {},
): Promise<HydrateResult[]> {
  const conc = Math.max(1, Math.min(8, opts.concurrency ?? 3));
  const results: HydrateResult[] = new Array(urls.length);
  let idx = 0;

  async function runner() {
    while (true) {
      const my = idx++;
      if (my >= urls.length) return;
      try {
        results[my] = await hydrateImage(admin, urls[my], opts);
      } catch (e: any) {
        results[my] = {
          ok: false,
          reason: 'decode_failed',
          detail: e?.message || 'uncaught',
          source_url: urls[my],
        };
      }
    }
  }

  await Promise.all(Array.from({ length: conc }, () => runner()));
  return results;
}
