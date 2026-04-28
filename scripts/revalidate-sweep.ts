'use server';

// ISR 일괄 revalidate sweep — admin only.
// 호출 예: 어드민 UI 의 폼 action / 어드민 라우트의 server action 사용처에서 import 해 호출.
//   import { revalidateSweep } from '@/scripts/revalidate-sweep';
//   await revalidateSweep();
//
// 동작:
//   1) requireAdmin() 으로 로그인 + is_admin 검증.
//   2) /apt, /blog, /feed 루트 + /blog/[slug] 전체, /apt/[slug] 전체, /apt/region/* 전체 revalidatePath.

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';

export interface RevalidateSweepResult {
  ok: boolean;
  counts?: { blogSlugs: number; aptSlugs: number; regionPages: number; rootRoutes: number };
  error?: string;
}

export async function revalidateSweep(): Promise<RevalidateSweepResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return { ok: false, error: 'forbidden' };
  const { admin } = auth;

  // 루트 라우트 — /stock 서브루트(/dividend, /themes 등) + /write, /discuss, /hot 추가.
  // /stock/[symbol] 같은 동적 종목 페이지(728건)는 너무 많아 자연 회전에 맡김.
  const ROOT_ROUTES = [
    '/apt', '/blog', '/feed', '/apt/region',
    '/stock', '/stock/dividend', '/stock/themes', '/stock/compare', '/stock/movers', '/stock/search',
    '/write',
    '/discuss', '/hot',
  ];
  for (const r of ROOT_ROUTES) revalidatePath(r);

  // /blog/[slug]
  let blogSlugs = 0;
  try {
    const { data: blogRows } = await (admin as any)
      .from('blog_posts')
      .select('slug')
      .eq('is_published', true)
      .not('slug', 'is', null);
    for (const b of blogRows || []) {
      if (b.slug) {
        revalidatePath(`/blog/${b.slug}`);
        blogSlugs++;
      }
    }
  } catch {}

  // /apt/[slug]
  let aptSlugs = 0;
  try {
    const { data: aptRows } = await (admin as any)
      .from('apt_sites')
      .select('slug')
      .eq('is_active', true)
      .not('slug', 'is', null);
    for (const a of aptRows || []) {
      if (a.slug) {
        revalidatePath(`/apt/${a.slug}`);
        aptSlugs++;
      }
    }
  } catch {}

  // /apt/region/[region], /apt/region/[region]/[sigungu], /apt/region/[region]/[sigungu]/[category]
  let regionPages = 0;
  try {
    const { data: regionRows } = await (admin as any)
      .from('apt_sites')
      .select('region, sigungu')
      .eq('is_active', true)
      .not('region', 'is', null);
    const regionSet = new Set<string>();
    const sigunguSet = new Set<string>();
    for (const r of regionRows || []) {
      if (r.region) regionSet.add(r.region);
      if (r.region && r.sigungu) sigunguSet.add(`${r.region}|${r.sigungu}`);
    }
    for (const region of regionSet) {
      revalidatePath(`/apt/region/${region}`);
      regionPages++;
    }
    for (const key of sigunguSet) {
      const [region, sigungu] = key.split('|');
      revalidatePath(`/apt/region/${region}/${sigungu}`);
      for (const cat of ['subscription', 'unsold', 'redev', 'landmark']) {
        revalidatePath(`/apt/region/${region}/${sigungu}/${cat}`);
        regionPages++;
      }
      regionPages++;
    }
  } catch {}

  return {
    ok: true,
    counts: { blogSlugs, aptSlugs, regionPages, rootRoutes: ROOT_ROUTES.length },
  };
}
