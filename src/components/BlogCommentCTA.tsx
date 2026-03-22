'use client';

export default function BlogCommentCTA({ commentCount }: { commentCount: number }) {
  if (commentCount > 0) return null;
  return (
    <div style={{
      margin: '24px 0', padding: '20px', borderRadius: 16, textAlign: 'center',
      background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(96,165,250,0.08) 100%)',
      border: '1px solid rgba(167,139,250,0.15)',
    }}>
      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        이 글에 대해 어떻게 생각하세요?
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
        첫 번째 댓글의 주인공이 되어보세요! 댓글 작성 시 포인트가 적립됩니다.
      </div>
    </div>
  );
}
