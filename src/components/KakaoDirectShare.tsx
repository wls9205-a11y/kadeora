'use client';
import { useToast } from '@/components/Toast';

interface Props {
  title: string;
  description?: string;
  pagePath: string;
}

export default function KakaoDirectShare({ title, description, pagePath }: Props) {
  const { success } = useToast();

  const trackShare = (platform: string) => {
    fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, content_type: 'apt', content_ref: pagePath }) }).catch(() => {});
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${pagePath}?utm_source=kakao&utm_medium=share` : '';
    const ogImage = typeof window !== 'undefined' ? `${window.location.origin}/api/og?title=${encodeURIComponent(title)}&design=2` : '';

    try {
      const kakao = (window as any).Kakao;
      if (kakao) {
        if (!kakao.isInitialized()) {
          const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
          if (key) kakao.init(key);
        }
        if (kakao.isInitialized() && kakao.Share) {
          kakao.Share.sendDefault({
            objectType: 'feed',
            content: { title, description: description || '카더라에서 확인하세요', imageUrl: ogImage, link: { mobileWebUrl: url, webUrl: url } },
            buttons: [{ title: '카더라에서 보기', link: { mobileWebUrl: url, webUrl: url } }],
          });
          trackShare('kakao');
          return;
        }
      }
    } catch { /* fall through */ }
    await navigator.clipboard.writeText(url);
    success('링크가 복사됐어요! 카카오톡에서 붙여넣기 해주세요');
    trackShare('kakao');
  };

  return (
    <button onClick={handleShare} aria-label="카카오톡으로 공유" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '6px 12px', borderRadius: 'var(--radius-sm)',
      background: '#FEE500', color: '#191919', border: 'none',
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
      height: 32, cursor: 'pointer',
    }}>
      💬 카카오톡
    </button>
  );
}
