/**
 * BlogGatedRenderer — 서버 컴포넌트. content(md) + gated_sections + user 를 받아
 * free/gated 섹션을 순서대로 렌더.
 *
 * 비로그인 유저가 gated('login') 섹션을 만나면 BlogGatedWall 로 preview + CTA.
 * 로그인 유저는 free, 프리미엄은 premium 섹션 모두 열람.
 */

import { marked } from 'marked';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { splitMarkdownByH2, classifyChunks, type GatedSectionMeta } from '@/lib/blog-gated-split';
import BlogGatedWall from './BlogGatedWall';

interface Props {
  content: string;
  gatedSections?: GatedSectionMeta[] | null;
  isLoggedIn: boolean;
  isPremium: boolean;
  slug: string;
}

function mdToHtml(md: string): string {
  const html = marked(md, { async: false }) as string;
  return sanitizeHtml(html);
}

export default function BlogGatedRenderer({ content, gatedSections, isLoggedIn, isPremium, slug }: Props) {
  const chunks = splitMarkdownByH2(content || '');
  const classified = classifyChunks(chunks, gatedSections);

  return (
    <div className="blog-content" itemProp="articleBody">
      {classified.map((c, i) => {
        if (c.kind === 'free') {
          const body = c.h2 ? `## ${c.h2}\n\n${c.md}` : c.md;
          return <div key={i} dangerouslySetInnerHTML={{ __html: mdToHtml(body) }} />;
        }
        // gated
        const canView = c.gate === 'premium' ? isPremium : isLoggedIn;
        if (canView) {
          const body = `## ${c.h2}\n\n${c.md}`;
          return <div key={i} dangerouslySetInnerHTML={{ __html: mdToHtml(body) }} />;
        }
        const previewHtml = mdToHtml(c.previewMd);
        return (
          <BlogGatedWall
            key={i}
            h2={c.h2}
            previewHtml={previewHtml}
            gate={c.gate}
            ctaText={c.ctaText}
            redirectPath={`/blog/${slug}`}
            ctaSource={c.gate === 'premium' ? 'blog_gated_premium' : 'blog_gated_login'}
          />
        );
      })}
    </div>
  );
}
