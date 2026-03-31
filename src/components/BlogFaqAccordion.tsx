'use client';
import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

interface Props {
  items: FaqItem[];
}

export default function BlogFaqAccordion({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!items || items.length === 0) return null;

  return (
    <div style={{ margin: '24px 0' }}>
      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>
        자주 묻는 질문
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            borderRadius: 'var(--radius-card)', border: '1px solid var(--border)',
            overflow: 'hidden', background: 'var(--bg-surface)',
          }}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '12px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', color: 'var(--text-primary)',
                fontSize: 'var(--fs-base)', fontWeight: 600, gap: 12,
              }}
            >
              <span>Q. {item.question}</span>
              <span style={{
                color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', flexShrink: 0,
                transition: 'transform 0.2s',
                transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0)',
              }}>
                ▼
              </span>
            </button>
            {openIndex === i && (
              <div style={{
                padding: '0 16px 14px', fontSize: 'var(--fs-sm)',
                color: 'var(--text-secondary)', lineHeight: 1.7,
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
              }}>
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
