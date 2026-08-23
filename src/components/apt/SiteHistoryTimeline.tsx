// V13 A-3 — 현장 진행 이력 세로 타임라인.
//
// 이게 "남들보다 유익한 정보" 다. 청약홈에도 아실에도 없다.
//
//   2026-08-20  시공사 선정  코오롱글로벌      확정 · DART 공시
//   2026-05-02  사업시행인가                   확정 · 부산진구 고시
//   2025-11-14  조합설립                       확정
//
// ⚠️ 이력이 0건이면 이 컴포넌트를 호출부에서 렌더하지 말 것. 빈 섹션을 만들지 않는다.
// ⚠️ 등급을 감추지 말 것. 추정·카더라를 확정처럼 보이게 하면 표시·광고법 문제가 된다.
//    광고 랜딩에서는 아예 confirmed 만 넘긴다 (lib/apt/site-events.ts · confirmedOnly).

import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import type { AptSiteEvent } from '@/lib/apt/site-events';

/** 등급 표기. 색은 전부 기존 토큰 — 새 CSS 변수를 만들지 않는다. */
const CONFIDENCE: Record<string, { label: string; color: string; weight: number }> = {
  confirmed: { label: '확정', color: 'var(--text-primary)', weight: 700 },
  estimated: { label: '추정', color: 'var(--text-secondary)', weight: 600 },
  rumor: { label: '카더라 · 미확인', color: 'var(--text-tertiary)', weight: 600 },
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
        const grade = CONFIDENCE[e.confidence ?? 'confirmed'] ?? CONFIDENCE.confirmed;
        const src = sourceLabel(e.source);
        const isLast = i === events.length - 1;

        return (
          <li
            key={e.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '78px 12px minmax(0, 1fr)',
              gap: 8,
              alignItems: 'start',
              padding: '0 0 12px',
            }}
          >
            <time
              dateTime={e.occurred_at}
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                color: 'var(--text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                paddingTop: 1,
              }}
            >
              {fmtDate(e.occurred_at)}
            </time>

            {/* 눈금 — 점 + 이어지는 선. 마지막 항목은 선을 그리지 않는다. */}
            <span aria-hidden="true" style={{ position: 'relative', display: 'block', height: '100%', minHeight: 20 }}>
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  left: 3,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: grade.color,
                }}
              />
              {!isLast && (
                <span
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 5,
                    bottom: -12,
                    width: 1,
                    background: 'var(--border)',
                  }}
                />
              )}
            </span>

            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: grade.weight, color: grade.color, lineHeight: 1.45 }}>
                {detail && e.event_type === 'stage_change' ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{detail} </span>
                ) : null}
                {title}
                {detail && e.event_type !== 'stage_change' ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}> {detail}</span>
                ) : null}
              </span>

              {e.note && (
                <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 2, wordBreak: 'keep-all' }}>
                  {e.note}
                </span>
              )}

              <span style={{ display: 'block', fontSize: 10.5, lineHeight: 1.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {grade.label}
                {src ? ' · ' : ''}
                {src && e.source_url ? (
                  <a href={e.source_url} target="_blank" rel="nofollow noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>
                    {src}
                  </a>
                ) : (
                  src
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
