import React from 'react';

/**
 * SpeakableSchema — Google AI Overview / 음성검색 인용 가능성 강화.
 *  WebPage + speakable.cssSelector JSON-LD.
 */

interface Props {
  url: string;
  title?: string;
  selectors?: string[];
}

const DEFAULT_SELECTORS = [
  'h1',
  '.blog-summary',
  '.blog-faq-question',
  'meta[name="description"]',
];

export default function SpeakableSchema({ url, title, selectors }: Props) {
  const cssSelector = selectors && selectors.length > 0 ? selectors : DEFAULT_SELECTORS;
  const payload: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url,
    ...(title ? { name: title } : {}),
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
