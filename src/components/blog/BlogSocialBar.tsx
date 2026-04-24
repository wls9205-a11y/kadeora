'use client';

import { useState } from 'react';

type Props = {
  title: string;
  description?: string;
  slug: string;
  coverImage?: string;
  commentCount?: number;
  helpfulCount?: number;
  commentAnchorId?: string;
};

export default function BlogSocialBar({
  title,
  description = '',
  slug,
  coverImage,
  commentCount = 0,
  helpfulCount = 0,
  commentAnchorId = 'blog-comments',
}: Props) {
  const [copied, setCopied] = useState(false);

  const fireBeacon = (cta: string) => {
    try {
      const body = JSON.stringify({
        event_type: 'cta_click',
        cta_name: cta,
        category: 'engagement',
        page_path: typeof window !== 'undefined' ? window.location.pathname : '',
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
      }
    } catch {}
  };

  const handleKakao = () => {
    fireBeacon('blog_social_kakao');
    try {
      const k = (window as any).Kakao;
      if (!k || !k.Share) {
        alert('카카오 SDK 로딩 중. 잠시 후 다시 시도해주세요.');
        return;
      }
      const fullUrl = `https://kadeora.app/blog/${slug}`;
      k.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description: description || title,
          imageUrl: coverImage || `https://kadeora.app/api/og?title=${encodeURIComponent(title)}&category=blog&design=2`,
          link: { mobileWebUrl: fullUrl, webUrl: fullUrl },
        },
        buttons: [{
          title: '자세히 보기',
          link: { mobileWebUrl: fullUrl, webUrl: fullUrl },
        }],
      });
    } catch (e) {
      console.error('Kakao share failed:', e);
    }
  };

  const handleCopy = async () => {
    fireBeacon('blog_social_copy');
    try {
      const url = `https://kadeora.app/blog/${slug}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleScrollToComments = () => {
    fireBeacon('blog_social_comments');
    const el = document.getElementById(commentAnchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const btn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'border-color 0.12s, background 0.12s',
  };

  return (
    <div
      role="toolbar"
      aria-label="공유 및 소셜 액션"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        margin: '12px 0 20px',
        padding: '10px 12px',
        background: 'linear-gradient(135deg, rgba(254,229,0,0.04), rgba(59,123,246,0.03))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <button
        onClick={handleKakao}
        style={{
          ...btn,
          background: '#FEE500',
          color: '#191919',
          border: '1px solid rgba(0,0,0,0.06)',
          fontWeight: 700,
        }}
        aria-label="카카오톡으로 공유"
      >
        💬 카카오톡 공유
      </button>

      <button
        onClick={handleCopy}
        style={btn}
        aria-label="링크 복사"
      >
        {copied ? '✓ 복사됨' : '🔗 링크 복사'}
      </button>

      <button
        onClick={handleScrollToComments}
        style={btn}
        aria-label={`댓글 ${commentCount}개 보기`}
      >
        💬 댓글 {commentCount > 0 ? commentCount.toLocaleString() : ''}
      </button>

      <div style={{ flex: 1 }} />

      {helpfulCount > 0 && (
        <div
          style={{
            ...btn,
            cursor: 'default',
            border: '1px solid rgba(239,68,68,0.18)',
            background: 'rgba(239,68,68,0.05)',
            color: '#F87171',
          }}
          aria-label={`좋아요 ${helpfulCount}개`}
        >
          ❤️ {helpfulCount.toLocaleString()}
        </div>
      )}
    </div>
  );
}
