// DS-2 — 디자인 시스템 프리뷰 (중단점 C 리뷰 자리).
//
// ⚠️ 설계서는 `/design` 이라고 적었지만 `/admin/design` 에 뒀다.
//    이유: 설계서가 요구한 것은 «noindex + 어드민 게이트» 인데, 그 둘이 이미
//    `/admin/*` 에 «작동하는 형태로» 있다 —
//      · middleware.ts PROTECTED_PATHS 에 '/admin' 이 있고 로그인 + is_admin 을 본다
//      · admin/layout.tsx 가 robots { index:false, follow:false } 를 준다
//    `/design` 으로 새로 파면 미들웨어에 경로를 «추가» 해야 하는데, 그 파일은
//    CSP 전용 규칙(아키텍처 규칙 #4)이 걸린 자리라 디자인 커밋이 건드릴 곳이 아니다.
//    게이트를 새로 만드는 것보다 «이미 도는 게이트 뒤» 에 두는 쪽이 유출 위험이 0 이다.
//
// ⚠️ 이 페이지는 «카탈로그» 다. 여기서 잘 보인다고 화면에서 잘 보이는 게 아니다 —
//    실제 대비 판정은 scripts/contrast-audit.ts 가 «토큰 계산값» 으로 한다.
//    사람이 볼 것은 크기·리듬·문구이지 대비가 아니다.

import type { Metadata } from 'next';
import { Badge, Chip } from '@/components/ds/Badge';
import VerifiedBadge from '@/components/ds/VerifiedBadge';
import { CONFIDENCE, CONFIDENCE_UNKNOWN, TONE, type Tone } from '@/components/ds/tone';

export const metadata: Metadata = {
  title: 'DS 프리뷰',
  robots: { index: false, follow: false },
};

const TONES = Object.keys(TONE) as Tone[];
/** DB 제약과 «같은 순서» — 약한 것에서 강한 것으로. */
const CONF_ORDER = ['rumor', 'estimated', 'confirmed', 'verified'] as const;

function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--sp-2xl)' }}>
      <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        {title}
      </h2>
      {note && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '0 0 12px', lineHeight: 1.6 }}>
          {note}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>{children}</div>
    </section>
  );
}

export default function DesignPreviewPage() {
  return (
    <main style={{ maxWidth: 'var(--container-read)', margin: '0 auto', padding: 'var(--sp-lg)' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        디자인 시스템 프리뷰
      </h1>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-2xl)', lineHeight: 1.6 }}>
        DS-2 표준 컴포넌트 카탈로그 · 중단점 C 리뷰 자리.
        대비는 여기서 «눈으로» 판정하지 않는다 — <code>scripts/contrast-audit.ts</code> 가 토큰 계산값으로 잰다.
      </p>

      <Row
        title="② 배지 — 톤 6종"
        note="색을 props 로 받지 않는다. 의미(톤)만 받는다. 그래야 감사 스크립트가 잴 표가 생긴다."
      >
        {TONES.map((t) => (
          <Badge key={t} tone={t}>{t}</Badge>
        ))}
      </Row>

      <Row title="② 배지 — md 치수">
        {TONES.map((t) => (
          <Badge key={t} tone={t} size="md">{t}</Badge>
        ))}
      </Row>

      <Row
        title="② 칩 — 누를 수 있는 것"
        note="배지와 칩의 차이는 «누를 수 있는가» 하나다. 누를 수 있으면 44px 터치 타깃을 지킨다."
      >
        <Chip>전체</Chip>
        <Chip selected>부산</Chip>
        <Chip>경남</Chip>
        <Chip href="#none">링크형</Chip>
      </Row>

      <Row
        title="⑥ 검증 뱃지 — D6 확신도"
        note="어휘는 DB 제약이 원본이다: rumor · estimated · confirmed · verified, 그리고 null 허용.
              ⛔ 「conflicting」은 확신도가 아니라 검수 큐 이름이라 뱃지로 만들지 않았다."
      >
        {CONF_ORDER.map((c) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <VerifiedBadge confidence={c} />
            <code style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c}</code>
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <VerifiedBadge confidence={null} />
          <code style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>null</code>
        </span>
      </Row>

      <Row
        title="⑥ 검증 뱃지 — 문구"
        note="색만으로 의미를 전달하지 않는다. 라벨이 항상 함께 가고, title 로 «무슨 뜻인지» 를 사용자 언어로 붙인다."
      >
        <table style={{ borderCollapse: 'collapse', fontSize: 'var(--fs-xs)', width: '100%' }}>
          <tbody>
            {CONF_ORDER.map((c) => (
              <tr key={c} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px 8px 0', width: 90 }}><VerifiedBadge confidence={c} /></td>
                <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>{CONFIDENCE[c].hint}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '8px 10px 8px 0' }}><VerifiedBadge confidence={null} /></td>
              <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>{CONFIDENCE_UNKNOWN.hint}</td>
            </tr>
          </tbody>
        </table>
      </Row>

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-2xl)', lineHeight: 1.7 }}>
        남은 표준: ①행/카드(B7-1 SiteRow 승격) · ③SectionHeader · ④CTA 2종 + 하단 고정 2버튼 바(B8 패턴) ·
        ⑤폼 필드 · ⑦관측 카드 · ⑧빈 상태·스켈레톤.
      </p>
    </main>
  );
}
