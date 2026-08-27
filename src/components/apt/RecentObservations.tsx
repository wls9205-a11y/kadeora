/**
 * A6 — 「최근 관측」. 사실 한 줄씩.
 *
 * ⚠️ 0건이면 «렌더하지 않는다». 빈 섹션은 「여기 뭔가 있어야 하는데 없다」로 읽힌다.
 * ⚠️ 리드폼 앵커(#lead) «바로 위» 에 둔다. 관측을 읽고 바로 신청으로 이어지는 자리다.
 * ⛔ 「오늘·어제」를 쓰지 않는다 — 줄 끝에 «기준일» 을 날짜로 적는다.
 */

import Link from 'next/link';

export interface ObservationRow {
  id: number;
  kind: string;
  title: string;
  link_path: string;
  observed_at: string;
}

const KIND_LABEL: Record<string, string> = {
  trade: '실거래',
  schedule: '일정',
  stage: '단계',
  unsold: '미분양',
  digest: '요약',
  issue: '이슈',
};

function md(d: string): string {
  const [, m, day] = (d || '').split('-');
  return m && day ? `${Number(m)}.${Number(day)}` : '';
}

export default function RecentObservations({ items }: { items: ObservationRow[] }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="apt-card" aria-labelledby="apt-obs-h">
      <h2 id="apt-obs-h" className="obs-h">최근 관측</h2>
      <ul className="obs-list">
        {items.slice(0, 5).map((o) => (
          <li key={o.id}>
            <Link href={o.link_path} className="obs-row">
              <span className="obs-kind">{KIND_LABEL[o.kind] || o.kind}</span>
              <span className="obs-title">{o.title}</span>
              <span className="obs-date">{md(o.observed_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
