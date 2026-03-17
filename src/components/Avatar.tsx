'use client';
import Image from 'next/image';
import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  nickname?: string | null;
  size?: number;
  isAnonymous?: boolean;
}

export default function Avatar({ src, nickname, size = 32, isAnonymous = false }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (isAnonymous) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--bg-hover)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5, flexShrink: 0,
      }}>👤</div>
    );
  }

  if (src && !imgError) {
    return (
      <Image
        src={src} alt={nickname ?? '유저'} width={size} height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={() => setImgError(true)}
      />
    );
  }

  const initial = nickname?.charAt(0)?.toUpperCase() ?? '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--brand), var(--info))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, color: 'var(--text-inverse)',
      flexShrink: 0, userSelect: 'none',
    }}>
      {initial}
    </div>
  );
}
