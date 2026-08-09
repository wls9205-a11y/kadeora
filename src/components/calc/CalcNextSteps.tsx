// s274 — 계산기 → 서비스 본체 연결 블록.
//
// 배경: 계산기는 네이버 유입의 50% (30일 550건 / 401명) 를 혼자 책임지는데,
// 네이버 방문자의 80% 가 1페이지만 보고 이탈한다. 계산이 끝난 사람에게
// "그래서 다음에 뭘 보면 되는지" 를 주는 자리가 페이지에 없었다.
//
// DB 조회는 일부러 하지 않는다. 계산기 페이지는 현재 76KB / TTFB 0.1s 로
// 사이트에서 가장 빠른 축인데, 여기에 쿼리를 붙이면 그 장점을 깎는다.
// 카테고리 → 목적지 정적 매핑으로 충분하다.

import Link from 'next/link';

type Step = { href: string; label: string; desc: string; icon: string };

const APT_STEPS: Step[] = [
  { href: '/apt',          label: '청약 일정',   desc: '접수중·마감임박 단지 D-day 순', icon: '🏢' },
  { href: '/apt/diagnose', label: '청약 가점 진단', desc: '무주택·부양가족 가점 자동 계산', icon: '🏥' },
  { href: '/apt/complex',  label: '단지백과',    desc: '전국 단지 연차별 실거래가',     icon: '📗' },
];

const STOCK_STEPS: Step[] = [
  { href: '/stock',          label: '오늘의 이슈 종목', desc: '거래량·등락 급변 종목',     icon: '📈' },
  { href: '/stock/dividend', label: '배당주 TOP',      desc: '고배당 종목 순위',          icon: '💎' },
  { href: '/stock/compare',  label: '종목 비교',       desc: '핵심 지표 나란히 비교',     icon: '⚖️' },
];

const COMMUNITY_STEPS: Step[] = [
  { href: '/feed',  label: '커뮤니티',      desc: '같은 고민 하는 사람들의 실제 후기', icon: '💬' },
  { href: '/blog',  label: '분석 블로그',   desc: '세금·재테크 데이터 분석 글',        icon: '📰' },
  { href: '/daily', label: '데일리 리포트', desc: '매일 아침 시장 요약',               icon: '📊' },
];

// 계산 주제와 실제로 이어지는 곳으로만 보낸다. 급여·군대 계산기에서 청약을
// 들이미는 식의 억지 연결은 클릭도 안 되고 신뢰만 깎는다.
const BY_CATEGORY: Record<string, Step[]> = {
  'property-tax': APT_STEPS,
  'real-estate':  APT_STEPS,
  'loan':         [APT_STEPS[0], APT_STEPS[2], COMMUNITY_STEPS[0]],
  'inheritance':  [APT_STEPS[2], COMMUNITY_STEPS[0], COMMUNITY_STEPS[1]],

  'investment':   STOCK_STEPS,
  'finance-tax':  STOCK_STEPS,
  'pension':      [STOCK_STEPS[1], COMMUNITY_STEPS[1], COMMUNITY_STEPS[0]],

  'income-tax':   COMMUNITY_STEPS,
  'year-end':     COMMUNITY_STEPS,
  'biz-tax':      COMMUNITY_STEPS,
  'salary':       COMMUNITY_STEPS,
  'auto':         COMMUNITY_STEPS,
  'life':         COMMUNITY_STEPS,
  'law':          COMMUNITY_STEPS,
  'military':     COMMUNITY_STEPS,
  'shopping':     COMMUNITY_STEPS,
};

type Props = {
  category: string;
};

// 토픽 허브(/calc/topic/[keyword]) 링크는 일부러 넣지 않았다. 그 slug 는 레지스트리
// keyword 가 아니라 DB calc_topic_clusters.topic_slug 라, 정적으로 만들면 404 가 난다.
// 붙이려면 조회가 필요한데 그건 이 컴포넌트를 정적으로 둔 이유와 상충한다.
export default function CalcNextSteps({ category }: Props) {
  const steps = BY_CATEGORY[category] ?? COMMUNITY_STEPS;

  return (
    <section
      aria-labelledby="calc-next-heading"
      style={{
        marginTop: 24,
        padding: '14px 14px 12px',
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-surface, #0D1730)',
        border: '1px solid var(--border, #1E3258)',
      }}
    >
      <h2
        id="calc-next-heading"
        style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px', color: 'var(--text-primary, #F2F5FA)' }}
      >
        계산은 끝났고, 다음은
      </h2>
      <p style={{ fontSize: 11.5, color: 'var(--text-tertiary, #8BA3C0)', margin: '0 0 10px' }}>
        숫자만 보고 끝내지 마세요. 실제 매물·종목·사람들 이야기로 이어집니다.
      </p>

      <div style={{ display: 'grid', gap: 7 }}>
        {steps.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 11px',
              borderRadius: 'var(--radius-sm, 6px)',
              background: 'var(--bg-elevated, #132040)',
              border: '1px solid var(--border, #1E3258)',
              color: 'var(--text-primary, #F2F5FA)',
              textDecoration: 'none',
            }}
          >
            <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>{s.icon}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>{s.label}</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #8BA3C0)', marginTop: 1 }}>
                {s.desc}
              </span>
            </span>
            <span aria-hidden style={{ fontSize: 13, color: 'var(--text-tertiary, #8BA3C0)' }}>›</span>
          </Link>
        ))}
      </div>

    </section>
  );
}
