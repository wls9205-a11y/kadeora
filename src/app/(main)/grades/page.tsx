import type { Metadata } from 'next';
import { SITE_URL, GRADE_COLORS } from '@/lib/constants';
import { createSupabaseServer as createClient } from '@/lib/supabase-server';

export const revalidate = 3600; // 1시간 캐시 — 등급 정보는 자주 안 바뀜

export const metadata: Metadata = {
  title: '회원 등급 안내',
  description: '카더라 회원 등급 시스템 — 새싹부터 카더라신까지 10단계. 활동 포인트, 등급별 혜택, 등업 조건을 확인하세요.',
  alternates: { canonical: SITE_URL + '/grades' },
  openGraph: {
    title: '카더라 회원 등급 시스템',
    description: '새싹부터 카더라신까지 10단계 등급 안내',
    url: SITE_URL + '/grades',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('회원 등급 안내')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 등급 시스템' }],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': '2026-01-15T00:00:00Z', 'naver:updated_time': new Date().toISOString(), 'dg:plink': SITE_URL + '/grades' },
};


export default async function GradesPage() {
  const supabase = await createClient();
  const { data: grades } = await supabase
    .from('grade_definitions')
    .select('grade,title,emoji,color_hex,description,min_score')
    .order('grade');

  let userPoints: number | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('points').eq('id', user.id).single();
      userPoints = profile?.points || 0;
    }
  } catch {}

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '등급 안내' }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: '카더라 등급은 어떻게 결정되나요?', acceptedAnswer: { '@type': 'Answer', text: '활동 포인트(글 작성 +10P, 댓글 +5P, 출석 +10P 등)를 기준으로 자동 등급이 부여됩니다. 매일 새벽 자동 갱신됩니다.' } },
          { '@type': 'Question', name: '최고 등급은 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: '카더라신(10단계)이 최고 등급입니다. 새싹→풀잎→클로버→벚꽃→해바라기→스타→파이어→다이아→왕관→카더라신 순서입니다.' } },
          { '@type': 'Question', name: '등급별 혜택이 있나요?', acceptedAnswer: { '@type': 'Answer', text: '높은 등급일수록 프로필 뱃지, 커뮤니티 신뢰도 표시, 향후 프리미엄 기능 우선 접근 등의 혜택이 제공됩니다.' } },
          { '@type': 'Question', name: '포인트는 어떻게 획득하나요?', acceptedAnswer: { '@type': 'Answer', text: '글 작성(+10P), 댓글(+5P), 출석체크(+10P), 좋아요 받기(+2P), 초대(+50P) 등 다양한 활동으로 포인트를 적립할 수 있습니다.' } },
        ],
      }) }} />
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          🏆 회원 등급 안내
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          카더라에서 활동할수록 영향력 점수가 쌓여 등급이 올라갑니다.
          게시글 작성, 댓글, 좋아요를 받을수록 더 빠르게 성장해요!
        </p>
      </div>

      {/* 내 등급 진행률 */}
      {userPoints !== null && grades && grades.length > 0 && (() => {
        const sorted = [...(grades || [])].sort((a: any, b: any) => a.min_score - b.min_score);
        const current = sorted.filter((g: any) => userPoints! >= g.min_score).pop();
        const next = sorted.find((g: any) => g.min_score > userPoints!);
        if (!current) return null;
        const remaining = next ? next.min_score - userPoints! : 0;
        const progress = next ? ((userPoints! - current.min_score) / (next.min_score - current.min_score)) * 100 : 100;
        return (
          <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{current.emoji} {current.title} (Lv.{current.grade})</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{userPoints}P</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: 'var(--brand)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            {next ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                다음 등급 {next.emoji} {next.title}까지 <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{remaining}P</span> 남았어요!
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--accent-green)', textAlign: 'center', fontWeight: 700 }}>🎉 최고 등급 달성!</div>
            )}
          </div>
        );
      })()}

      {/* 점수 획득 방법 */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ backgroundColor: 'var(--brand-light)', border: '1px solid var(--brand)' }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--brand)' }}>📈 점수 획득 방법</p>
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>• 게시글 작성 +10점</li>
          <li>• 게시글에 좋아요 받기 +2점</li>
          <li>• 댓글 작성 +3점</li>
          <li>• 팔로워 획득 +5점</li>
          <li>• 매가폰 사용 +20점</li>
          <li>• 출석 체크 +1점/일</li>
        </ul>
      </div>

      {/* 등급 목록 */}
      <div className="space-y-3">
        {(grades ?? []).map((g: any) => (
          <div
            key={g.grade}
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            {/* 등급 번호 */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black shrink-0"
              style={{ backgroundColor: GRADE_COLORS[g.grade] + '22', color: GRADE_COLORS[g.grade] }}
            >
              {g.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Lv.{g.grade} {g.title}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: GRADE_COLORS[g.grade] + '22', color: GRADE_COLORS[g.grade] }}
                >
                  {(g.min_score ?? 0).toLocaleString()}점~
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {g.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-center mt-8" style={{ color: 'var(--text-tertiary)' }}>
        등급 시스템은 추후 업데이트될 수 있습니다.
      </p>
    </div>
  );
}
