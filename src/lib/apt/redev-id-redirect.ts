// BN 7차 판독 — /apt/redev/{redevelopment_projects.id} 죽은 링크(120일 1,426편 · 발행 154) 본문 불변 해소.
//
// internal-link-injector 가 정비구역명을 /apt/redev/{id} 로 걸어 왔지만 그 라우트는 없다(/apt/redev/[region] 만).
// 본문은 고칠 수 없으므로(발행 본문 수정 금지) 라우트가 숫자 인자를 받아 308 로 넘긴다.
//   ① 연결 현장(apt_sites.source_ids.redev_id · 활성) → /apt/<slug>
//   ② 연결 없음 → 구역 소속 시·도 목록 /apt/redev/<시·도>  (404 잔존 0)
//   ③ 시·도도 모름 → /apt/redev
// 매핑은 DB 조회를 하루 캐시한다(글마다 같은 id 가 반복된다).
import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const VALID = new Set(['서울', '경기', '부산', '인천', '대구', '광주', '대전', '울산', '세종', '경남', '경북', '충남', '충북', '전남', '전북', '강원', '제주']);

/** 경로 조각은 인코딩한다 — 한글 slug 리다이렉트에서 여러 번 당했다. */
const seg = (s: string) => encodeURIComponent(s);

async function resolveUncached(id: string): Promise<string> {
  const sb = getSupabaseAdmin() as any;
  const { data: site } = await sb.from('apt_sites').select('slug')
    .eq('source_ids->>redev_id', id).eq('is_active', true).limit(1).maybeSingle();
  if (site?.slug) return `/apt/${seg(site.slug)}`;
  const { data: proj } = await sb.from('redevelopment_projects').select('region').eq('id', id).maybeSingle();
  const region = String(proj?.region ?? '').trim();
  if (VALID.has(region)) return `/apt/redev/${seg(region)}`;
  return '/apt/redev';
}

export const resolveRedevIdTarget = unstable_cache(resolveUncached, ['apt-redev-id-redirect'], { revalidate: 86_400 });

/** 숫자 인자인가(/apt/redev/2093). */
export const isRedevNumericId = (s: string) => /^\d{1,9}$/.test(s);
