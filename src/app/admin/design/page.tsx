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
import CtaPanel, { KakaoActionButton } from '@/components/ds/CtaPanel';
import { ACTION_SLOT } from '@/components/ds/ActionBar';
// ① · ③ 은 «이미 있던 것을 표준으로 승격» 한다. 옮기지 않는다 — 옮기면 import 만 대량으로
//    흔들리고 얻는 게 없다. 카탈로그에 실물을 세워 「이것이 표준이다」를 보이는 것으로 충분하다.
import SiteRow from '@/components/apt/SiteRow';
import SectionHeader from '@/components/apt/SectionHeader';
import RecentObservations from '@/components/apt/RecentObservations';
import Field from '@/components/ds/Field';
import EmptyState, { Skeleton } from '@/components/ds/EmptyState';

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

      <Row
        title="① 행 — B7-1 공용 2줄 행 (표준 1호)"
        note="같은 「현장 한 줄」을 /apt 두 덩어리 · 홈 · 「다른 현장」이 제각기 그리던 것을 하나로 모은 것.
              null 은 «항목째» 사라진다 — 「해운대구 ·  · 」 같은 줄을 만들지 않는다."
      >
        <div className="kd-srows" style={{ width: '100%' }}>
          <SiteRow item={{ slug: 'sample-a', name: '래미안 마크더스위트', region: '부산', sigungu: '남구', lifecycle_stage: 'subscription_open', total_units: 1256, dday: 3, date: '2026-08-30' }} />
          <SiteRow item={{ slug: 'sample-b', name: '가야1구역 재개발', region: '부산', sigungu: '부산진구', lifecycle_stage: 'site_planning', total_units: null, date: null }} />
        </div>
      </Row>

      <Row title="③ SectionHeader — 섹션 3단 리듬" note="eyebrow / H2 / 우측 meta. 제목에 이모지를 넣지 않는다.">
        <div style={{ width: '100%' }}>
          <SectionHeader eyebrow="FEATURED — 분양중" title="이번 주 모집공고" meta="부산 · 182곳 · 모집공고 기준" />
        </div>
      </Row>

      <Row
        title="④-a CTA 2종 — 틴트 색면 / 흰 카드"
        note="⛔ 둘을 «인접 배치하지 않는다»(S7-3). 붙여 놓으면 「무엇을 눌러야 하나」가 생겨 둘 다 안 눌린다.
              이 카탈로그에서는 «비교를 위해» 나란히 뒀다 — 개발 모드 콘솔에 경고가 찍히는 것이 정상이다."
      >
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', width: '100%' }}>
          <CtaPanel
            kind="lead"
            band="분양 정보 안내 · 무료"
            title="분양 정보 안내 신청"
            lede="담당자가 직접 연락드려 잔여 세대·일정을 안내합니다."
            action={
              <button type="button" style={{ ...ACTION_SLOT, width: '100%', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', cursor: 'pointer' }}>
                신청하기
              </button>
            }
          />
          <CtaPanel
            kind="signup"
            title="관심 현장 알림 받기"
            lede="단계가 바뀌면 가장 먼저 알려드립니다."
            action={<KakaoActionButton>카카오로 3초 만에 시작</KakaoActionButton>}
          />
        </div>
      </Row>

      <Row
        title="④-b 하단 고정 2버튼 바 (B8 패턴)"
        note="50/50 · 동일 높이 · 한 줄. 위계는 «크기» 가 아니라 «색과 자리» 로 준다.
              아래는 고정 배치를 뗀 «형태만» 보여 주는 것이다 — 실물은 화면 하단에 고정된다."
      >
        <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 420 }}>
          <button type="button" style={{ ...ACTION_SLOT, background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', cursor: 'pointer' }}>
            분양 정보 안내 신청
          </button>
          <a href="#none" style={{ ...ACTION_SLOT, background: 'var(--kakao-bg)', color: 'var(--kakao-text)', textDecoration: 'none' }}>
            카카오톡방 입장
          </a>
        </div>
      </Row>

      <Row
        title="⑤ 폼 필드"
        note="입력 글자는 16px 하한이다 — iOS 사파리는 16px 미만 입력에 포커스가 가면 화면을 «확대» 한다.
              폼이 화면 밖으로 밀리고 사용자는 자기가 뭘 잘못 눌렀는지 모른 채 떠난다. 리드폼에서는 곧 전환 손실이다.
              에러는 색으로만 말하지 않는다 — 문장 + aria-invalid + role=alert."
      >
        <div style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 420 }}>
          <Field label="이름" placeholder="홍길동" required />
          <Field label="휴대폰" placeholder="01012345678" inputMode="numeric" hint="- 없이 숫자만 입력해 주세요" />
          <Field
            label="휴대폰"
            defaultValue="0101234"
            error="휴대폰 번호를 - 없이 11자리로 입력해 주세요"
          />
        </div>
      </Row>

      <Row
        title="⑦ 관측 카드 (A6 승격)"
        note="사실 한 줄씩. ⛔ 「오늘·어제」를 쓰지 않고 줄 끝에 «기준일» 을 날짜로 적는다.
              0건이면 «렌더하지 않는다» — 빈 섹션은 「여기 뭔가 있어야 하는데 없다」로 읽힌다."
      >
        <div style={{ width: '100%' }}>
          <RecentObservations
            items={[
              { id: 1, kind: 'trade', title: '남구 대연동 전용 84㎡ 9억 2,000만원', link_path: '/apt/area/부산/남구', observed_at: '2026-08-28' },
              { id: 2, kind: 'stage', title: '가야1구역 조합설립인가', link_path: '/apt/sample-b', observed_at: '2026-08-26' },
            ]}
          />
        </div>
      </Row>

      <Row
        title="⑧ 빈 상태 — 「비어 있음」과 「못 불러옴」은 다른 상태다"
        note="⛔ 사과하지 않는다. ⛔ 「데이터가 없습니다」로 뭉치지 않는다 — 없는 것인지 못 불러온 것인지를 안 가른다.
              ✅ 다음 행동을 말하고, 가능하면 그 길을 같이 준다."
      >
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', width: '100%' }}>
          <EmptyState
            kind="search"
            title="「해운대 아이파크」로 찾은 현장이 없습니다"
            hint="이름 대신 지역으로 찾으면 더 많이 나옵니다."
            action={<Chip href="#none">부산 현장 보기</Chip>}
          />
          <EmptyState
            kind="error"
            title="목록을 불러오지 못했습니다"
            hint="잠시 뒤 다시 시도하면 대부분 해결됩니다."
            action={<Chip>다시 불러오기</Chip>}
          />
        </div>
      </Row>

      <Row
        title="⑧ 스켈레톤 — 올 것의 «모양» 을 그린다"
        note="스피너를 쓰지 않는다. 스피너는 「얼마나 남았나」도 「무엇이 올까」도 안 알려 준다.
              도착 순간 레이아웃이 흔들리지 않는 것이 실제 이득이다(CLS).
              prefers-reduced-motion 에서는 움직이지 않는다."
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Skeleton rows={3} />
        </div>
      </Row>

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-2xl)', lineHeight: 1.7 }}>
        표준 8종 완성. 다음은 <strong>DS-2d — 뽀짝 A안 스케일 적용</strong>(라운드 8/12/16 · 촘촘 리듬,
        예외 하단 CTA 바 48px). 토큰 «값만» 바꾸고 약 2,200곳이 따라오는지가 이 트랙의 성공 판정이다.
        <br />
        ⚠️ ④-b 는 «아직 어느 화면도 쓰지 않는다». 살아 있는 인스턴스는 SiteActionBar 이고,
        그 교체는 /apt/[id] 를 만지는 일이라 U-1층 몫이다(설계서 §0 상세 동결).
      </p>
    </main>
  );
}
