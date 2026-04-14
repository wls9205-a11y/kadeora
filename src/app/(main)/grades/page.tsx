import type { Metadata } from 'next';
import { SITE_URL, GRADE_COLORS } from '@/lib/constants';
import { createSupabaseServer as createClient } from '@/lib/supabase-server';
import ShareButtons from '@/components/ShareButtons';

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
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('회원 등급 안내')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 등급 시스템' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('회원 등급')}&category=general`, width: 630, height: 630 },
    ],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:author': '카더라', 'naver:written_time': new Date().toISOString(), 'naver:updated_time': new Date().toISOString(), 'dg:plink': SITE_URL + '/grades' },
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
      const { data: profile } = await supabase.from('profiles').select('points').eq('id', user.id).maybeSingle();
      userPoints = profile?.points || 0;
    }
  } catch {}

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '등급 안내' }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: '회원 등급 안내 — 카더라', url: `${SITE_URL}/grades`, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.grade-description'] } }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: '카더라 등급은 어떻게 결정되나요?', acceptedAnswer: { '@type': 'Answer', text: '활동 포인트(글 작성 +10P, 댓글 +5P, 출석 +10P 등)를 기준으로 자동 등급이 부여됩니다. 매일 새벽 자동 갱신됩니다.' } },
          { '@type': 'Question', name: '최고 등급은 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: '카더라신(10단계)이 최고 등급입니다. 새싹→정보통→동네어른→소문난집→인플루언서→빅마우스→찐고수→전설→신의경지→카더라신 순서입니다.' } },
          { '@type': 'Question', name: '등급별 혜택이 있나요?', acceptedAnswer: { '@type': 'Answer', text: '높은 등급일수록 프로필 뱃지, 커뮤니티 신뢰도 표시, 향후 프리미엄 기능 우선 접근 등의 혜택이 제공됩니다.' } },
          { '@type': 'Question', name: '포인트는 어떻게 획득하나요?', acceptedAnswer: { '@type': 'Answer', text: '글 작성(+10P), 댓글(+5P), 출석체크(+10P), 공유(+5P), 관심단지 등록(+50P) 등 다양한 활동으로 포인트를 적립할 수 있습니다.' } },
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
        <div style={{ marginTop: 8 }}><ShareButtons title="카더라 회원 등급 안내 — 등급별 혜택 확인" contentType="page" contentRef="grades" /></div>
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
          <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{current.emoji} {current.title} (Lv.{current.grade})</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{userPoints}P</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: 'var(--brand)', borderRadius: 4, transition: 'width 0.3s' }} />
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

      {/* 등급별 실질 혜택 */}
      <div style={{ marginBottom: 24 }}>
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>🎁 등급별 혜택</h2>
        <div className="space-y-2">
          {[
            { emoji: '🌱', grade: 'Lv.1~3', title: '새싹 ~ 동네어른', benefits: ['블로그 전문 열람', '커뮤니티 글·댓글 작성', '청약 가점 계산기', '종목 토론 참여'] },
            { emoji: '⭐', grade: 'Lv.4~5', title: '소문난집 ~ 인플루언서', benefits: ['AI 종목 분석 월 3회 무료', '주간 리포트 이메일 수신', '프로필 등급 뱃지 표시', '인기글 우선 노출'] },
            { emoji: '🔥', grade: 'Lv.6~7', title: '빅마우스 ~ 찐고수', benefits: ['AI 종목 분석 월 10회 무료', '광고 50% 감소', '전문가 채팅방 접근', '커뮤니티 이벤트 우선 참여'] },
            { emoji: '👑', grade: 'Lv.8~10', title: '전설 ~ 카더라신', benefits: ['AI 분석 무제한', '광고 완전 제거', 'Pro 멤버십 기능 무료 체험', '신규 기능 베타 테스터 우선 초대'] },
          ].map((tier, i) => (
            <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{tier.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{tier.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{tier.grade}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {tier.benefits.map((b, j) => (
                  <div key={j} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--brand)', fontSize: 10 }}>✓</span> {b}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 점수 획득 방법 */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ backgroundColor: 'var(--brand-light)', border: '1px solid var(--brand)' }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--brand)' }}>📈 점수 획득 방법</p>
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>• 게시글 작성 +10점</li>
          <li>• 게시글에 좋아요 받기 — 준비 중</li>
          <li>• 댓글 작성 +5점</li>
          <li>• 공유 +5점</li>
          <li>• 관심단지 등록 +50점</li>
          <li>• 출석 체크 +10점/일</li>
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
