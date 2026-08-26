// V13 A-3 / V15 B — 현장 진행 이력 세로 타임라인.
//
// 이게 "남들보다 유익한 정보" 다. 청약홈에도 아실에도 없다.
//
//   2026.08.20  ●  시공사 선정  코오롱글로벌      [확정] DART 공시
//   2026.05.02  ●  사업시행인가                   [확정] 부산진구 고시
//   2025.11.14  ○  조합설립                       [추정]
//
// ⚠️ 이력이 0건이면 이 컴포넌트를 호출부에서 렌더하지 말 것. 빈 섹션을 만들지 않는다.
// ⚠️ 등급을 감추지 말 것. 추정·카더라를 확정처럼 보이게 하면 표시·광고법 문제가 된다.
//    광고 랜딩에서는 아예 confirmed 만 넘긴다 (lib/apt/site-events.ts · confirmedOnly).

import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import type { AptSiteEvent } from '@/lib/apt/site-events';

/**
 * 등급 표기. 색은 전부 기존 토큰 — 새 CSS 변수를 만들지 않는다.
 * 점 색은 확정만 --brand 다. 추정·카더라를 브랜드 색으로 찍으면
 * 눈금만 훑고 확정으로 읽는다.
 */
const CONFIDENCE: Record<
  string,
  { label: string; dot: string; ring: string; badgeBg: string; badgeFg: string }
> = {
  confirmed: {
    label: '확정',
    dot: 'var(--brand)',
    ring: 'var(--brand-bg)',
    badgeBg: 'var(--accent-green-bg)',
    badgeFg: 'var(--accent-green)',
  },
  estimated: {
    label: '추정',
    dot: 'var(--text-tertiary)',
    ring: 'var(--bg-sunken)',
    badgeBg: 'var(--accent-orange-bg)',
    badgeFg: 'var(--accent-orange)',
  },
  rumor: {
    label: '카더라',
    dot: 'var(--text-tertiary)',
    ring: 'var(--bg-sunken)',
    badgeBg: 'var(--bg-sunken)',
    badgeFg: 'var(--text-tertiary)',
  },
  // ⚠️ 등급이 비어 있는 이벤트가 실측 13건 있다 (트리거가 현장의 null confidence 를 그대로 옮긴다).
  //    이걸 '확정' 으로 그리면 근거 없는 정보에 확정 딱지를 붙이게 된다.
  unknown: {
    label: '미확인',
    dot: 'var(--text-tertiary)',
    ring: 'var(--bg-sunken)',
    badgeBg: 'var(--bg-sunken)',
    badgeFg: 'var(--text-tertiary)',
  },
};

/**
 * source 는 기계용 문자열이다. 사람이 읽을 값만 드러낸다.
 * migration:* 은 내부 이관 흔적이라 출처로 말하지 않는다 — 출처를 물으면 답이 없다.
 */
function sourceLabel(source: string | null): string | null {
  if (!source) return null;
  if (source.startsWith('migration:')) return null;
  if (source === 'dart') return 'DART 공시';
  if (source === 'admin') return '카더라 확인';
  // V16 D: 머신 토큰 경로(pg_net 대량 입력). 사람이 직접 확인한 것과 구분한다.
  if (source === 'admin:machine') return '카더라 확인(자동)';
  if (source === 'cron') return null;
  return source;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

/** 이벤트 한 줄의 제목과 값. 종류마다 무엇이 바뀌었는지가 다르다. */
function describe(e: AptSiteEvent): { title: string; detail: string | null } {
  switch (e.event_type) {
    case 'stage_change': {
      const to = lifecycleLabel(e.to_value) ?? '단계 변경';
      const from = lifecycleLabel(e.from_value);
      return { title: to, detail: from ? `${from} →` : null };
    }
    case 'constructor':
      return { title: '시공사', detail: e.to_value };
    case 'units': {
      const from = e.from_value ? `${Number(e.from_value).toLocaleString('ko-KR')}세대` : null;
      const to = e.to_value ? `${Number(e.to_value).toLocaleString('ko-KR')}세대` : null;
      return { title: '세대수', detail: [from, to].filter(Boolean).join(' → ') || null };
    }
    case 'price':
      return { title: '분양가', detail: e.to_value };
    case 'note':
      return { title: '메모', detail: null };
    default:
      return { title: e.event_type, detail: e.to_value };
  }
}

export default function SiteHistoryTimeline({ events }: { events: AptSiteEvent[] }) {
  if (!events || events.length === 0) return null;

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {events.map((e, i) => {
        const { title, detail } = describe(e);
        // 모르는 값·빈 값은 '미확인' 이다. 확정으로 떨어뜨리지 않는다.
        const grade = CONFIDENCE[e.confidence ?? ''] ?? CONFIDENCE.unknown;
        const src = sourceLabel(e.source);
        const isLast = i === events.length - 1;

        return (
          <li
            key={e.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '68px 14px minmax(0, 1fr)',
              gap: 8,
              alignItems: 'start',
              paddingBottom: isLast ? 0 : 14,
            }}
          >
            <time
              dateTime={e.occurred_at}
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
                lineHeight: 1.5,
                color: 'var(--text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                paddingTop: 3,
              }}
            >
              {fmtDate(e.occurred_at)}
            </time>

            {/* 눈금 — 세로선 위에 점을 얹는다.
                점 둘레의 표면색 테두리가 선을 끊어 점이 앞으로 나온다.
                흰색을 직접 쓰지 않는다 — 다크 모드에서 점 주위가 흰 구멍이 된다. */}
            <span
              aria-hidden="true"
              style={{ position: 'relative', display: 'block', alignSelf: 'stretch', minHeight: 22 }}
            >
              {!isLast && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6.25,
                    bottom: -14,
                    width: 1.5,
                    background: 'var(--border)',
                  }}
                />
              )}
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  left: 3.5,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: grade.dot,
                  boxShadow: `0 0 0 2px var(--bg-surface), 0 0 0 3.5px ${grade.ring}`,
                }}
              />
            </span>

            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  letterSpacing: 0,   // fs-xs(14px) — 자간 규칙상 14px 이하는 0
                  color: 'var(--text-primary)',
                  lineHeight: 1.45,
                }}
              >
                {detail && e.event_type === 'stage_change' ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{detail} </span>
                ) : null}
                {title}
                {detail && e.event_type !== 'stage_change' ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}> {detail}</span>
                ) : null}
              </span>

              {e.note && (
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--fs-xs)',
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                    marginTop: 2,
                    wordBreak: 'keep-all',
                  }}
                >
                  {e.note}
                </span>
              )}

              <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <span
                  style={{
                    flexShrink: 0,
                    padding: '1.5px 5px',
                    borderRadius: 3,
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 500,
                    lineHeight: 1.4,
                    background: grade.badgeBg,
                    color: grade.badgeFg,
                  }}
                >
                  {grade.label}
                </span>
                {src && (
                  <span
                    style={{
                      minWidth: 0,
                      fontSize: 'var(--fs-xs)',
                      lineHeight: 1.4,
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.source_url ? (
                      <a
                        href={e.source_url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {src}
                      </a>
                    ) : (
                      src
                    )}
                  </span>
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
