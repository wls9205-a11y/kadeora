'use client';

interface Props {
  title: string;
  description: string;
  slug: string;
  coverImage?: string;
}

export default function KakaoShareButton({ title, description, slug, coverImage }: Props) {
  const handleShare = () => {
    const url = `${window.location.origin}/blog/${slug}`;
    const kakao = (window as any).Kakao;
    if (kakao?.Share) {
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description: description.slice(0, 100),
          imageUrl: coverImage?.startsWith('/') ? `${window.location.origin}${coverImage}` : (coverImage || `${window.location.origin}/api/og?title=${encodeURIComponent(title.slice(0, 40))}`),
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: '자세히 보기', link: { mobileWebUrl: url, webUrl: url } }],
      });
    } else {
      navigator.clipboard?.writeText(url);
      alert('링크가 복사됐어요! 카카오톡에서 붙여넣기 해주세요');
    }
  };

  return (
    <button
      onClick={handleShare}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 20, border: 'none',
        background: '#FEE500', color: '#191919', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      💬 카카오톡 공유
    </button>
  );
}
