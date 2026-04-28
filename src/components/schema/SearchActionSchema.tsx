import React from 'react';

/**
 * SearchActionSchema — WebSite + Organization + SearchAction JSON-LD.
 *  layout.tsx 에 이미 동일 페이로드가 있으므로 호환용 (중복 마운트 시 Google
 *  은 무시함). 별도 페이지에서 sameAs 를 다르게 설정해야 할 때만 사용.
 */

interface Props {
  origin: string;
  searchPath?: string; // default: /search
  sameAs?: string[];
}

export default function SearchActionSchema({ origin, searchPath = '/search', sameAs = [] }: Props) {
  const payload = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}#website`,
        url: origin,
        name: '카더라',
        ...(sameAs.length > 0 ? { sameAs } : {}),
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}${searchPath}?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${origin}#organization`,
        url: origin,
        name: '카더라',
        logo: { '@type': 'ImageObject', url: `${origin}/icons/icon-192.png`, width: 192, height: 192 },
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
