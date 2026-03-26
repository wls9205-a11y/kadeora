'use client';
import { SITE_URL } from '@/lib/constants';

interface Props {
  inviteCode: string;
  inviteCount: number;
  onCopy: (msg: string) => void;
}

export default function InviteSection({ inviteCode, inviteCount, onCopy }: Props) {
  const inviteUrl = `${SITE_URL}/login?invite=${inviteCode}`;

  const handleKakaoShare = () => {
    try {
      const kakao = typeof window !== 'undefined' ? (window as any).Kakao : null;
      if (kakao) {
        if (!kakao.isInitialized()) {
          const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
          if (key) kakao.init(key);
        }
        if (kakao.isInitialized() && kakao.Share) {
          kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: '카더라 — 주식·부동산 소식 같이 봐요 🏘',
              description: `가입하면 둘 다 +50P! 초대코드: ${inviteCode}`,
              imageUrl: SITE_URL + '/api/og',
              link: { mobileWebUrl: inviteUrl, webUrl: inviteUrl },
            },
            buttons: [{ title: '카더라 가입하기', link: { mobileWebUrl: inviteUrl, webUrl: inviteUrl } }],
          });
          return;
        }
      }
    } catch { /* fallback below */ }
    navigator.clipboard.writeText(inviteUrl);
    onCopy('초대 링크가 복사됐어요!');
  };

  return (
    <div style={{ marginTop: 16, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>👥 친구 초대</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        친구가 이 코드로 가입하면 둘 다 +50 포인트!
        {inviteCount > 0 && <span style={{ marginLeft: 8, color: 'var(--brand)', fontWeight: 700 }}>초대 {inviteCount}명 완료!</span>}
      </div>
      <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12, fontSize: 22, fontWeight: 800, letterSpacing: 4, color: 'var(--brand)', textAlign: 'center', marginBottom: 12 }}>
        {inviteCode}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { navigator.clipboard.writeText(inviteUrl); onCopy('초대 링크가 복사됐어요!'); }}
          style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          🔗 링크복사
        </button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button onClick={async () => {
            try {
              await navigator.share({ title: '카더라 - 청약·주식·부동산 커뮤니티', text: '카더라에서 청약·주식·부동산 정보 같이 봐요! 👉', url: inviteUrl });
            } catch {}
          }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--brand)', color: 'var(--text-inverse)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📤 공유하기
          </button>
        )}
        <button onClick={handleKakaoShare}
          style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          💬 카카오톡 공유
        </button>
      </div>
    </div>
  );
}
