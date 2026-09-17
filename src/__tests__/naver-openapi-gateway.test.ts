import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import {
  naverOpenApiFetch,
  naverEndpointOf,
  kstDate,
  flushNaverOpenApiUsage,
  __peekNaverOpenApiBuffer,
} from '@/lib/naver/openapi';

describe('B4 네이버 오픈API 관문', () => {
  const realFetch = globalThis.fetch;
  beforeEach(async () => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    await flushNaverOpenApiUsage(); // 이전 테스트 잔여 비우기
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('엔드포인트를 경로에서 뽑는다', () => {
    expect(naverEndpointOf('https://openapi.naver.com/v1/search/news.json?query=a')).toBe('search/news');
    expect(naverEndpointOf('https://openapi.naver.com/v1/search/image?query=a')).toBe('search/image');
    expect(naverEndpointOf('https://openapi.naver.com/v1/datalab/search')).toBe('datalab/search');
  });

  it('KST 날짜 — UTC 15시 이후는 다음 날', () => {
    expect(kstDate(new Date('2026-09-17T14:59:59Z'))).toBe('2026-09-17');
    expect(kstDate(new Date('2026-09-17T15:00:00Z'))).toBe('2026-09-18');
  });

  it('응답은 그대로 돌려주고 ok/429/기타/예외를 센다 — 원장 쓰기는 한 번', async () => {
    const statuses = [200, 429, 500];
    let i = 0;
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: statuses[i++] })) as any;
    const url = 'https://openapi.naver.com/v1/search/webkr?query=x';
    const r1 = await naverOpenApiFetch('cron/test', url);
    const r2 = await naverOpenApiFetch('cron/test', url);
    const r3 = await naverOpenApiFetch('cron/test', url);
    expect([r1.status, r2.status, r3.status]).toEqual([200, 429, 500]);

    globalThis.fetch = vi.fn(async () => { throw new Error('timeout'); }) as any;
    await expect(naverOpenApiFetch('cron/test', url)).rejects.toThrow('timeout');

    const buf = __peekNaverOpenApiBuffer();
    expect(buf).toHaveLength(1);
    expect(buf[0]).toMatchObject({ route: 'cron/test', endpoint: 'search/webkr', calls: 4, http_429: 1, http_other_err: 2 });

    await flushNaverOpenApiUsage();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('naver_openapi_usage_incr');
    expect(__peekNaverOpenApiBuffer()).toHaveLength(0);
  });

  it('원장 적재 실패는 호출을 깨지 않고 console.error 로 남긴다', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as any;
    rpc.mockResolvedValue({ error: { message: 'db down' } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await naverOpenApiFetch('cron/test', 'https://openapi.naver.com/v1/search/blog?query=x');
    expect(res.status).toBe(200);
    await flushNaverOpenApiUsage();
    expect(err).toHaveBeenCalled();
    expect(String(err.mock.calls[0][0])).toContain('원장 적재 실패');
    err.mockRestore();
  });
});
