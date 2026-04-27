import React from 'react';

interface OgCard {
  idx: number;
  type: string;
  url: string;
  alt?: string;
}

interface FaqItem {
  q: string;
  a: string;
}

interface BlogPostSchemaProps {
  post: {
    slug: string;
    title: string;
    excerpt?: string | null;
    meta_description?: string | null;
    category?: string | null;
    sub_category?: string | null;
    cover_image?: string | null;
    author_name?: string | null;
    author_role?: string | null;
    published_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    rewritten_at?: string | null;
    tags?: string[] | null;
    og_cards?: OgCard[] | null;
    faqs?: FaqItem[] | null;
    hub_cta_target?: string | null;
    hub_apt_slug?: string | null;
  };
  origin: string;
}

const CATEGORY_KO: Record<string, string> = {
  apt: '부동산',
  stock: '주식',
  unsold: '미분양',
  finance: '재테크',
  general: '뉴스',
};

export default function BlogPostSchema({ post, origin }: BlogPostSchemaProps) {
  const url = `${origin}/blog/${encodeURIComponent(post.slug)}`;
  const cards: OgCard[] = Array.isArray(post.og_cards) ? post.og_cards : [];
  const faqs: FaqItem[] = Array.isArray(post.faqs) ? post.faqs.filter(f => f && f.q && f.a) : [];
  const category = post.category || 'general';
  const categoryKo = CATEGORY_KO[category] || '카더라';

  const datePub = post.published_at || post.created_at || new Date().toISOString();
  const dateMod = post.updated_at || post.rewritten_at || datePub;
  const desc = (post.meta_description || post.excerpt || post.title).replace(/\s+/g, ' ').slice(0, 160);
  const heroImage = cards.length > 0
    ? (cards[0].url.startsWith('http') ? cards[0].url : `${origin}${cards[0].url}`)
    : (post.cover_image || `${origin}/api/og?title=${encodeURIComponent(post.title)}&category=${category}`);

  const article: Record<string, any> = {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: post.title.slice(0, 110),
    description: desc,
    url,
    datePublished: datePub,
    dateModified: dateMod,
    author: {
      '@type': 'Person',
      name: post.author_name || '카더라',
      ...(post.author_role ? { jobTitle: post.author_role } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: '카더라',
      url: origin,
      logo: { '@type': 'ImageObject', url: `${origin}/icons/icon-192.png`, width: 192, height: 192 },
    },
    image: [
      {
        '@type': 'ImageObject',
        url: heroImage,
        width: cards.length > 0 ? 630 : 1200,
        height: 630,
      },
    ],
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(post.tags && post.tags.length > 0 ? { keywords: post.tags.join(', ') } : {}),
    articleSection: post.sub_category || categoryKo,
  };

  const graph: Array<Record<string, any>> = [article];

  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '카더라', item: origin },
      { '@type': 'ListItem', position: 2, name: '블로그', item: `${origin}/blog` },
      { '@type': 'ListItem', position: 3, name: categoryKo, item: `${origin}/blog?category=${category}` },
      { '@type': 'ListItem', position: 4, name: post.title.slice(0, 80), item: url },
    ],
  });

  if (cards.length === 6) {
    graph.push({
      '@type': 'ImageGallery',
      '@id': `${url}#gallery`,
      name: `${post.title} 카드`,
      url,
      image: cards.map(c => ({
        '@type': 'ImageObject',
        url: c.url.startsWith('http') ? c.url : `${origin}${c.url}`,
        width: 630,
        height: 630,
        caption: c.alt || post.title,
      })),
    });
  }

  if (faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  const payload = {
    '@context': 'https://schema.org',
    '@graph': graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
