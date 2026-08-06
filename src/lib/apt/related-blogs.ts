// src/lib/apt/related-blogs.ts — s273
//
// /apt 하단 '관련 블로그 분석' 데이터.
//
// 매핑 규약 (s273 신설):
//   blog_posts.metadata.apt_id  =  apt_subscriptions.id (bigint)
//   → 청약 공고 1건에 대응하는 분석글을 가리킨다.
//   기입 주체: (1) pg_cron 'kadeora-series-autopublish' 가 발행 시점에 자동 기입
//             (2) scripts/backfill-blog-apt-id.mjs 가 기발행분을 소급 기입
//
// blog_posts 는 절대 DELETE 하지 않는다 (Architecture Rule #76). 여기서는 읽기만 한다.

import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export interface RelatedBlogPost {
  id: number;
  slug: string;
  title: string;
  published_at: string | null;
  apt_id: number | null;
}

const REVALIDATE = 900;

async function fetchRelatedUncached(aptIds: number[]): Promise<RelatedBlogPost[]> {
  try {
    const sb = getSupabaseAdmin();

    // 1) 지금 노출 중인 단지에 직접 매핑된 분석글 우선
    let mapped: RelatedBlogPost[] = [];
    if (aptIds.length > 0) {
      // PostgREST 에서 jsonb 필드 비교는 ->> (text) 로 해야 한다.
      // -> 는 jsonb 를 반환해서 int 배열과 타입이 안 맞는다.
      const { data, error } = await (sb as any)
        .from('blog_posts')
        .select('id, slug, title, published_at, metadata')
        .eq('is_published', true)
        .in('metadata->>apt_id', aptIds.map(String))
        .order('published_at', { ascending: false })
        .limit(6);
      if (error) {
        console.error('[apt/related-blogs] mapped query error:', error.message);
      } else {
        mapped = (data ?? []).map((r: any) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          published_at: r.published_at,
          apt_id: Number(r.metadata?.apt_id) || null,
        }));
      }
    }

    if (mapped.length >= 4) return mapped.slice(0, 6);

    // 2) 부족하면 최근 청약 카테고리 분석글로 채운다 (빈 섹션 방지 — Rule #97)
    const { data: recent, error: recentErr } = await (sb as any)
      .from('blog_posts')
      .select('id, slug, title, published_at, metadata')
      .eq('is_published', true)
      .eq('category', 'apt')
      .order('published_at', { ascending: false })
      .limit(12);

    if (recentErr) {
      console.error('[apt/related-blogs] recent query error:', recentErr.message);
      return mapped;
    }

    const seen = new Set(mapped.map((m) => m.id));
    for (const r of recent ?? []) {
      if (mapped.length >= 6) break;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      mapped.push({
        id: r.id,
        slug: r.slug,
        title: r.title,
        published_at: r.published_at,
        apt_id: Number((r as any).metadata?.apt_id) || null,
      });
    }
    return mapped.slice(0, 6);
  } catch (e: any) {
    console.error('[apt/related-blogs] caught:', e?.message ?? String(e));
    return [];
  }
}

const fetchRelatedCached = unstable_cache(fetchRelatedUncached, ['apt-related-blogs'], {
  revalidate: REVALIDATE,
  tags: ['apt-hub'],
});

export async function getRelatedBlogs(aptIds: number[]): Promise<RelatedBlogPost[]> {
  // 캐시 키 안정화 — 순서가 달라도 같은 집합이면 같은 키
  const key = [...new Set(aptIds)].sort((a, b) => a - b).slice(0, 20);
  return fetchRelatedCached(key);
}
