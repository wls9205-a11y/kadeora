'use client';
import { useEffect, useState } from 'react';
import { isTossMode, openInBrowser } from '@/lib/toss-mode';

/**
 * BlogTossGate — 토스 모드에서 블로그 본문을 30%만 보여주고 CTA 표시
 * 서버 컴포넌트에서 htmlFull/htmlTruncated를 모두 받아
 * 클라이언트에서 토스 모드 감지 후 전환
 */
export default function BlogTossGate({
  htmlFull,
  htmlShort,
  slug,
  title,
}: {
  htmlFull: string;
  htmlShort: string;
  slug: string;
  title: string;
}) {
  const [toss, setToss] = useState(false);

  useEffect(() => {
    if (isTossMode()) setToss(true);
  }, []);

  if (!toss) {
    // 일반 모드: 풀 콘텐츠 (서버에서 isLoggedIn 분기는 부모에서 처리)
    return (
      <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlFull }} />
    );
  }

  // 토스 모드: 30% + CTA
  return (
    <div style={{ position: 'relative' }}>
      <div
        className="blog-content"
        itemProp="articleBody"
        style={{ maxHeight: 'clamp(300px, 40vh, 500px)', overflow: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: htmlShort }}
      />
      {/* 그라디언트 오버레이 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
        background: 'linear-gradient(transparent, #F5F6F8)',
        pointerEvents: 'none',
      }} />
      {/* CTA */}
      <div style={{
        textAlign: 'center', padding: '28px 20px 20px',
        marginTop: -8, position: 'relative',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#191F28', marginBottom: 6 }}>
          전체 글은 카더라에서
        </div>
        <div style={{ fontSize: 13, color: '#8B95A1', marginBottom: 14, lineHeight: 1.5 }}>
          {title.length > 30 ? title.slice(0, 30) + '...' : title}
        </div>
        <button
          onClick={() => openInBrowser(`/blog/${slug}`)}
          style={{
            padding: '14px 36px', borderRadius: 'var(--radius-card)', border: 'none',
            background: 'linear-gradient(135deg, #1B64DA, #3182F6)',
            color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(49,130,246,0.3)',
          }}
        >
          전체 글 읽기
        </button>
        <div style={{ marginTop: 8, fontSize: 11, color: '#B0B8C1' }}>
          카더라 블로그 · 전편 무료
        </div>
      </div>
    </div>
  );
}
