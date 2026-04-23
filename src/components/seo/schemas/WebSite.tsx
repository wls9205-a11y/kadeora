import JsonLd from '../JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export default function WebSiteSchema() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '카더라',
        url: SITE_URL,
        inLanguage: 'ko-KR',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  );
}
