import type { ReactNode } from 'react';
import type { TocItem } from '@/lib/extractToc';
import BlogHeader, { type BlogCategory } from './BlogHeader';
import BlogTLDR, { type TldrKpi } from './BlogTLDR';
import BlogTOC from './BlogTOC';
import BlogPostFooter from './BlogPostFooter';
import RelatedAptSites, { type RelatedAptSite } from './RelatedAptSites';

interface BlogPostLike {
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  category?: BlogCategory | string | null;
  tags?: string[] | null;
  published_at?: string | null;
  reading_minutes?: number | null;
  reading_time?: number | null;
  author?: { nickname?: string | null; avatar_url?: string | null; bio?: string | null; slug?: string | null } | null;
  author_name?: string | null;
  author_avatar?: string | null;
}

export interface BlogPageCProps {
  post: BlogPostLike;
  tocItems: TocItem[];
  tldr?: TldrKpi[] | null;
  relatedAptSites?: RelatedAptSite[] | null;
  children: ReactNode;
}

export function BlogPageC({ post, tocItems, tldr, relatedAptSites, children }: BlogPageCProps) {
  const authorName = post.author?.nickname ?? post.author_name ?? null;
  const authorAvatar = post.author?.avatar_url ?? post.author_avatar ?? null;
  const authorBio = post.author?.bio ?? null;
  const authorSlug = post.author?.slug ?? null;
  const subtitle = post.subtitle ?? post.excerpt ?? null;
  const readingMinutes = post.reading_minutes ?? post.reading_time ?? null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 32,
        maxWidth: 1080,
        margin: '0 auto',
        padding: '0 16px',
      }}
      className="blog-page-c"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }} className="blog-page-c-grid">
        <aside className="blog-page-c-toc" style={{ display: 'none' }}>
          <BlogTOC items={tocItems} />
        </aside>
        <article style={{ minWidth: 0 }}>
          <BlogHeader
            title={post.title}
            subtitle={subtitle}
            category={post.category as BlogCategory}
            authorName={authorName}
            authorAvatar={authorAvatar}
            publishedAt={post.published_at}
            readingMinutes={readingMinutes}
          />
          {tldr && tldr.length > 0 && <BlogTLDR kpis={tldr} />}
          <BlogTOC items={tocItems} />
          <div className="blog-page-c-content">{children}</div>
          {relatedAptSites && relatedAptSites.length > 0 && (
            <RelatedAptSites sites={relatedAptSites} />
          )}
          <BlogPostFooter
            tags={post.tags ?? null}
            authorName={authorName}
            authorAvatar={authorAvatar}
            authorBio={authorBio}
            authorSlug={authorSlug}
          />
        </article>
      </div>
      <style>{`
        @media (min-width: 1024px) {
          .blog-page-c-grid { grid-template-columns: 240px minmax(0, 1fr); }
          .blog-page-c-toc { display: block !important; }
        }
      `}</style>
    </div>
  );
}

export default BlogPageC;
