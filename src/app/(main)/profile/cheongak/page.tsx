import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/constants';
import CheongakForm from './CheongakForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const metadata: Metadata = {
  // s212 P0-B: template 가 '| 카더라' 자동 추가
  title: '내 청약 가점',
  description: '무주택 기간·부양가족·청약통장 가입 기간 입력 → 자동 가점 계산 + 매칭 단지 알림',
  alternates: { canonical: `${SITE_URL}/profile/cheongak` },
  robots: { index: false, follow: false },
};

interface ProfileCheongak {
  cheongak_score: number | null;
  no_house_period_months: number | null;
  dependents_count: number | null;
  savings_period_months: number | null;
  cheongak_target_regions: string[] | null;
  cheongak_target_unit_min: number | null;
  cheongak_target_unit_max: number | null;
  cheongak_score_updated_at: string | null;
}

export default async function CheongakPage() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    redirect('/login?redirect=' + encodeURIComponent('/profile/cheongak'));
  }

  const { data } = await (sb as any).from('profiles')
    .select('cheongak_score, no_house_period_months, dependents_count, savings_period_months, cheongak_target_regions, cheongak_target_unit_min, cheongak_target_unit_max, cheongak_score_updated_at')
    .eq('id', user.id).maybeSingle();

  const profile: ProfileCheongak = (data ?? {
    cheongak_score: null,
    no_house_period_months: null,
    dependents_count: null,
    savings_period_months: null,
    cheongak_target_regions: [],
    cheongak_target_unit_min: null,
    cheongak_target_unit_max: null,
    cheongak_score_updated_at: null,
  }) as any;

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <header style={{ margin: '0 0 16px' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)' }}>내 청약 가점</h1>
        <p style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          입력 즉시 자동 합산. 관심 지역에 매칭되는 청약이 열리면 알림으로 알려드립니다.
          <br />
          한국 표준 가점제: 무주택 32점 + 부양가족 35점 + 청약통장 17점 = <strong>84점 만점</strong>.
        </p>
      </header>
      <CheongakForm initial={profile} />
    </article>
  );
}
