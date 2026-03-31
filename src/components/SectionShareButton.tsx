'use client';
import { useToast } from '@/components/Toast';
import { isTossMode, tossShare } from '@/lib/toss-mode';

interface Props {
  section: string;     // e.g. 'stock-heatmap', 'apt-region'
  label?: string;      // 공유 시 표시할 제목
  text?: string;       // 공유 시 표시할 본문 (없으면 label 사용)
  pagePath: string;    // e.g. '/stock', '/apt'
}

export default function SectionShareButton({ section, label, text, pagePath }: Props) {
  const { success } = useToast();

  const handleShare = async () => {
    const path = `${pagePath}?section=${section}`;

    // 토스 미니앱: intoss/toss 스킴 공유 (반려 사유 #1)
    if (isTossMode()) {
      const shared = await tossShare(label || '카더라', path);
      if (shared) return;
    }

    const url = `${window.location.origin}${path}`;

    // 모바일: 네이티브 공유 시트
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: label || '카더라', url });
        return;
      } catch { /* 취소 시 무시 */ }
    }

    // 데스크탑: 클립보드 복사
    try {
      await navigator.clipboard.writeText(url);
      success('링크가 복사됐어요! 공유해보세요');
    } catch {
      success('링크 복사에 실패했어요');
    }
  };

  return (
    <button
      onClick={handleShare}
      aria-label={`${label || '이 섹션'} 공유`}
      title="친구에게 공유하기"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(96,165,250,0.08) 100%)',
        border: '1px solid rgba(37,99,235,0.2)',
        color: 'var(--brand)', cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
        transition: 'all var(--transition-fast)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      공유하기
    </button>
  );
}
