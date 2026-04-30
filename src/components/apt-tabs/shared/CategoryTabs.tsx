/**
 * CategoryTabs
 *
 * 부동산 영역 6개 카테고리 탭. 활성 탭은 시그니처 컬러로 강조.
 * 데스크톱: 가로 일렬 + underline, 모바일: 가로 스크롤 chip.
 *
 * 서버 컴포넌트 (Link로 라우팅).
 */

import Link from 'next/link';
import type { CategoryId } from '../types';

type Props = {
  active: CategoryId;
  basePath?: string; // "/apt-v2" or "/apt"
};

const TABS: { id: CategoryId; label: string; href: string; signatureVar: string }[] = [
  { id: 'subscription', label: '청약', href: '', signatureVar: 'var(--aptr-tab-subscription)' },
  {
    id: 'transactions',
    label: '실거래',
    href: '/transactions',
    signatureVar: 'var(--aptr-tab-transactions)',
  },
  { id: 'site', label: '단지정보', href: '/site', signatureVar: 'var(--aptr-brand)' },
  {
    id: 'redevelopment',
    label: '재개발',
    href: '/redevelopment',
    signatureVar: 'var(--aptr-tab-redevelopment)',
  },
  { id: 'unsold', label: '미분양', href: '/unsold', signatureVar: 'var(--aptr-tab-unsold)' },
  { id: 'data', label: '데이터룸', href: '/data', signatureVar: 'var(--aptr-brand)' },
];

export function CategoryTabs({ active, basePath = '/apt-v2' }: Props) {
  return (
    <nav
      aria-label="부동산 카테고리"
      className="aptr-scroll-x"
      style={{
        background: 'var(--aptr-bg-card)',
        borderBottom: '0.5px solid var(--aptr-border-subtle)',
        display: 'flex',
        gap: '0',
        padding: '0 8px',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={`${basePath}${tab.href}`}
            className="aptr-link-reset aptr-focus"
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 14px',
              fontSize: '12px',
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--aptr-text-primary)' : 'var(--aptr-text-tertiary)',
              borderBottom: isActive ? `2px solid ${tab.signatureVar}` : '2px solid transparent',
              whiteSpace: 'nowrap',
              transition: 'color 0.12s ease',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
