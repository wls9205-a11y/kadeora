'use client';

export default function BlogCommentCTA({ commentCount }: { commentCount: number }) {
  if (commentCount > 0) return null;
  return (
    <div style={{
      margin: '24px 0', padding: '24px 20px', borderRadius: 'var(--radius-lg)', textAlign: 'center',
      background: 'linear-gradient(135deg, rgba(167,139,250,0.06) 0%, rgba(96,165,250,0.06) 100%)',
      border: '2px dashed rgba(167,139,250,0.2)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
        첫 번째 댓글의 주인공이 되어주세요!
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
        이 글에 대한 생각을 나눠주세요.<br />
        댓글을 남기면 포인트도 적립됩니다.
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 18px', borderRadius: 'var(--radius-pill)',
        background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)',
      }}>
        <span style={{ fontSize: 'var(--fs-sm)' }}>🎁</span>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-yellow)' }}>댓글 작성 시 5P 적립</span>
      </div>
    </div>
  );
}
