import JsonLd from '../JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

interface Props {
  slug: string;
  title: string;
  description: string;
  images: string[];
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  category?: string;
}

export default function BlogPostingSchema({ slug, title, description, images, datePublished, dateModified, authorName, category }: Props) {
  const url = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
  const absImages = (images || []).filter(Boolean).map((u) => (u.startsWith('http') ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`));
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title.slice(0, 110),
        description: (description || '').slice(0, 300),
        image: absImages.length > 0 ? absImages : [`${SITE_URL}/api/og?title=${encodeURIComponent(title)}&category=${category || 'blog'}`],
        datePublished,
        dateModified: dateModified || datePublished,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        url,
        inLanguage: 'ko-KR',
        author: {
          '@type': authorName ? 'Person' : 'Organization',
          name: authorName || '카더라',
          url: SITE_URL,
        },
        publisher: {
          '@type': 'Organization',
          name: '카더라',
          url: SITE_URL,
          logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-192.png`, width: 192, height: 192 },
        },
        articleSection: category || 'blog',
      }}
    />
  );
}
