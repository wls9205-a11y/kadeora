'use client';
/**
 * KakaoBottomSheet — ☆ 버튼 클릭 시 페이지 이탈 없이 미니 가입창
 *
 * 비로그인 유저가 관심등록/알림 등 기능을 누를 때 표시
 * 카카오 네이티브 버튼 + "다른 방법으로 가입하기" 링크
 */
import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { trackCTA } from '@/lib/analytics';

interface Props {
  open: boolean;
  onClose: () => void;
  feature?: string;
  title?: string;
  description?: string;
}

export default function KakaoBottomSheet({ open, onClose, feature = 'star', title, description }: Props) {
  const pathname = usePathname();
  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=kakao_sheet_${feature}`;
  const altUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=kakao_sheet_${feature}_alt`;

  useEffect(() => {
    if (open) {
      trackCTA('view', `kakao_sheet_${feature}`, { page_path: pathname });
    }
  }, [open, feature, pathname]);

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'ksFadeIn .2s ease-out',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 440,
        background: '#0C1528', borderRadius: '20px 20px 0 0',
        padding: '24px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        animation: 'ksSlideUp .25s ease-out',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />

        <div style={{ fontSize: 16, fontWeight: 500, color: '#ddd8d0', marginBottom: 4, textAlign: 'center' }}>
          {title || '회원 전용 기능이에요'}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 20, textAlign: 'center' }}>
          {description || '가입하면 바로 이용할 수 있어요'}
        </div>

        <Link
          href={loginUrl}
          onClick={() => trackCTA('click', `kakao_sheet_${feature}`, { page_path: pathname })}
          style={{
            display: 'flex', width: '100%', height: 48, borderRadius: 12,
            background: '#FEE500', alignItems: 'center', justifyContent: 'center',
            position: 'relative', textDecoration: 'none', boxSizing: 'border-box',
          }}
        >
          <svg style={{ position: 'absolute', left: 16 }} width="18" height="18" viewBox="0 0 512 512" fill="rgba(0,0,0,0.9)">
            <path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" />
          </svg>
          <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.85)', fontWeight: 500 }}>
            카카오톡으로 3초 만에 가입하기
          </span>
        </Link>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.16)', textAlign: 'center', marginTop: 12 }}>
          <Link
            href={altUrl}
            onClick={() => trackCTA('click', `kakao_sheet_${feature}_alt`, { page_path: pathname })}
            style={{ color: 'rgba(255,255,255,0.16)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            다른 방법으로 가입하기
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes ksFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes ksSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      `}</style>
    </div>
  );
}
