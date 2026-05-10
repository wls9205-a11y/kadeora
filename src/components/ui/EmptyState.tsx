// s265 — EmptyState 표준 컴포넌트.
// 빈 섹션 fallback. cascade RPC 가 L4 nationwide 까지 보장하므로 거의 발동 안 함
// (Architecture Rule #97). 정책 알림 등 region-strict 섹션의 0건만 노출.

import Link from 'next/link';

type Props = {
  icon?: string;       // emoji 또는 짧은 텍스트 (Tabler 미설치, 기본 📭)
  title: string;
  description?: string;
  cta?: { label: string; href: string };
};

export default function EmptyState({ icon = '📭', title, description, cta }: Props) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #F9FAFB)',
        border: '1px solid var(--border, #E5E7EB)',
        padding: '28px 16px',
        borderRadius: 8,
        textAlign: 'center',
        margin: '3px 3px 6px',
      }}
    >
      <div style={{ fontSize: 28, color: 'var(--text-tertiary, #9CA3AF)', marginBottom: 8, lineHeight: 1 }}>
        {icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
        {title}
      </div>
      {description ? (
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #6B7280)', marginTop: 4, lineHeight: 1.5 }}>
          {description}
        </div>
      ) : null}
      {cta ? (
        <Link
          href={cta.href}
          style={{
            display: 'inline-block',
            marginTop: 10,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--brand, #2563EB)',
            textDecoration: 'none',
          }}
        >
          {cta.label} →
        </Link>
      ) : null}
    </div>
  );
}
