'use client';

/**
 * BlogGatedRenderer — 클라이언트 컴포넌트.
 *
 * 마운트 시 get_my_access_level RPC 호출 → { is_authenticated, is_premium, is_admin,
 * access_level, premium_system_active } 수신. Toss 미연동 상태에서는 RPC 가
 * premium_system_active=false 를 보고 is_premium=true 로 반환해 프리미엄 게이트 자동 개방.
 *
 * 서버 prop fallback 으로 초기 상태(isLoggedIn/isPremium) 수신 → RPC 응답 전에는 이
 * 값을 사용. RPC 응답 후 access state 로 교체 → 필요한 섹션만 재평가.
 */

import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { splitMarkdownByH2, classifyChunks, type GatedSectionMeta } from '@/lib/blog-gated-split';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import BlogGatedWall from './BlogGatedWall';

interface Props {
  content: string;
  gatedSections?: GatedSectionMeta[] | null;
  /** SSR 초기값. RPC 응답 전 사용. */
  isLoggedIn: boolean;
  /** SSR 초기값 (보통 false). RPC 응답 후 교체. */
  isPremium: boolean;
  slug: string;
}

interface AccessLevel {
  is_authenticated: boolean;
  is_premium: boolean;
  is_admin?: boolean;
  access_level?: string;
  premium_system_active?: boolean;
}

function mdToHtml(md: string): string {
  const html = marked(md, { async: false }) as string;
  return sanitizeHtml(html);
}

export default function BlogGatedRenderer({ content, gatedSections, isLoggedIn, isPremium, slug }: Props) {
  const [access, setAccess] = useState<AccessLevel>({
    is_authenticated: isLoggedIn,
    is_premium: isPremium,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data, error } = await (sb.rpc as any)('get_my_access_level');
        if (cancelled || error || !data) return;
        // RPC 가 jsonb 반환 → 그대로 사용
        const obj = (typeof data === 'object' && data !== null ? data : {}) as unknown as AccessLevel;
        setAccess({
          is_authenticated: !!obj.is_authenticated,
          is_premium: !!obj.is_premium,
          is_admin: !!obj.is_admin,
          access_level: obj.access_level,
          premium_system_active: obj.premium_system_active,
        });
      } catch { /* silent — SSR 초기값 유지 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const chunks = useMemo(() => splitMarkdownByH2(content || ''), [content]);
  const classified = useMemo(() => classifyChunks(chunks, gatedSections), [chunks, gatedSections]);
  // C4: H2 섹션 중간 인덱스 — mid-gate sentinel 삽입 지점
  const midIdx = Math.max(1, Math.floor(classified.length / 2));

  return (
    <div className="blog-content" itemProp="articleBody">
      {classified.flatMap((c, i) => {
        const nodes: React.ReactNode[] = [];
        if (i === midIdx) nodes.push(<div key={`mid-sentinel-${i}`} data-mid-gate-sentinel aria-hidden />);
        if (c.kind === 'free') {
          const body = c.h2 ? `## ${c.h2}\n\n${c.md}` : c.md;
          nodes.push(<div key={`chunk-${i}`} dangerouslySetInnerHTML={{ __html: mdToHtml(body) }} />);
          return nodes;
        }
        const locked =
          (c.gate === 'login' && !access.is_authenticated) ||
          (c.gate === 'premium' && !access.is_premium);
        if (!locked) {
          const body = `## ${c.h2}\n\n${c.md}`;
          nodes.push(<div key={`chunk-${i}`} dangerouslySetInnerHTML={{ __html: mdToHtml(body) }} />);
          return nodes;
        }
        const previewHtml = mdToHtml(c.previewMd);
        nodes.push(
          <BlogGatedWall
            key={`wall-${i}`}
            h2={c.h2}
            previewHtml={previewHtml}
            gate={c.gate}
            ctaText={c.ctaText}
            position={i}
            redirectPath={`/blog/${slug}`}
            ctaSource={c.gate === 'premium' ? 'blog_gated_premium' : 'blog_gated_login'}
          />,
        );
        return nodes;
      })}
    </div>
  );
}
