import React from 'react';

/**
 * CollectionPageSchema — 블로그 카테고리/시리즈 페이지용.
 *  CollectionPage + ItemList(itemListOrderDescending, 최대 50).
 */

export interface CollectionItem {
  name: string;
  url: string;
  position?: number;
}

interface Props {
  url: string;
  name: string;
  description?: string;
  items: CollectionItem[];
  origin: string;
}

export default function CollectionPageSchema({ url, name, description, items, origin }: Props) {
  const list = items.slice(0, 50).map((it, i) => ({
    '@type': 'ListItem',
    position: it.position ?? i + 1,
    name: it.name,
    url: it.url.startsWith('http') ? it.url : `${origin}${it.url}`,
  }));

  const payload: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    url,
    name,
    ...(description ? { description } : {}),
    isPartOf: { '@type': 'WebSite', name: '카더라', url: origin },
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: list.length,
      itemListElement: list,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
