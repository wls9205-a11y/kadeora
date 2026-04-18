/**
 * [L0-6] YMYL (Your Money Your Life) 면책 배너
 * stock / finance / apt / unsold 카테고리 글에 자동 삽입.
 * 투자자문·법률 자문이 아님을 고지하고 출처·저자 자격을 드러내 E-E-A-T 강화.
 */

import Link from 'next/link';

interface Props {
  category: string;
  dataDate?: string | null;
  sourceRef?: string | null;
  authorName?: string | null;
  authorRole?: string | null;
}

const CAT_LABEL: Record<string, string> = {
  stock: '투자',
  finance: '재테크',
  apt: '부동산',
  unsold: '부동산',
};

export default function YMYLBanner({ category, dataDate, sourceRef, authorName, authorRole }: Props) {
  const label = CAT_LABEL[category] || '금융';
  return (
    <aside
      aria-label="투자자문 아님 고지"
      style={{
        margin: '0 0 16px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--warning-bg)',
        border: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: 'var(--text-primary)' }}>⚠️ 참고용 정보입니다</strong> · 본 글은 {label} 관련 정보 제공을 목적으로 하며
      투자자문·법률 자문이 아닙니다. 최종 결정은 독자의 판단과 책임으로 이루어져야 합니다.
      {dataDate ? <> · 데이터 기준일: {dataDate}</> : null}
      {sourceRef ? <> · 출처: {sourceRef.split(';')[0]?.split('|')[0] || sourceRef}</> : null}
      {authorName ? (
        <>
          {' '}· 저자:{' '}
          <Link href="/about/authors/node" style={{ color: 'var(--brand)', textDecoration: 'none' }}>
            {authorName}{authorRole ? ` (${authorRole.replace(/ \(AI 자동 생성\)$/, '')})` : ''}
          </Link>
        </>
      ) : null}
    </aside>
  );
}
