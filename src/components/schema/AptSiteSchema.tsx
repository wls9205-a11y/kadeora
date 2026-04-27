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

interface AptSiteSchemaProps {
  site: {
    slug: string;
    name: string;
    site_type?: string | null;
    region?: string | null;
    sigungu?: string | null;
    dong?: string | null;
    address?: string | null;
    description?: string | null;
    builder?: string | null;
    total_units?: number | null;
    price_min?: number | null;
    price_max?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    review_score?: number | null;
    review_count?: number | null;
    og_cards?: OgCard[] | null;
    faqs?: FaqItem[] | null;
    move_in_date?: string | null;
  };
  origin: string;
}

const SITE_TYPE_PATH: Record<string, string> = {
  subscription: '분양',
  redevelopment: '재개발',
  unsold: '미분양',
  trade: '실거래',
  landmark: '랜드마크',
  complex: '단지',
};

export default function AptSiteSchema({ site, origin }: AptSiteSchemaProps) {
  const url = `${origin}/apt/${encodeURIComponent(site.slug)}`;
  const stLabel = site.site_type ? SITE_TYPE_PATH[site.site_type] || '단지' : '단지';
  const cards: OgCard[] = Array.isArray(site.og_cards) ? site.og_cards : [];
  const hasGeo = site.latitude != null && site.longitude != null;
  const hasRating = (site.review_count ?? 0) > 0 && site.review_score != null;
  const hasOffer = site.price_min != null || site.price_max != null;
  const faqs: FaqItem[] = Array.isArray(site.faqs) ? site.faqs.filter(f => f && f.q && f.a) : [];

  const apartment: Record<string, any> = {
    '@type': 'Apartment',
    '@id': `${url}#apartment`,
    name: site.name,
    url,
    description: site.description || `${site.region || ''} ${site.sigungu || ''} ${site.name}`.trim(),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      addressRegion: site.region || undefined,
      addressLocality: site.sigungu || undefined,
      streetAddress: site.address || undefined,
    },
  };
  if (site.total_units) apartment.numberOfRooms = site.total_units;
  if (hasGeo) apartment.geo = { '@type': 'GeoCoordinates', latitude: site.latitude, longitude: site.longitude };
  if (site.builder) apartment.brand = { '@type': 'Organization', name: site.builder };

  const graph: Array<Record<string, any>> = [apartment];

  if (hasGeo) {
    graph.push({
      '@type': 'Place',
      '@id': `${url}#place`,
      name: site.name,
      geo: { '@type': 'GeoCoordinates', latitude: site.latitude, longitude: site.longitude },
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'KR',
        addressRegion: site.region || undefined,
        addressLocality: site.sigungu || undefined,
        streetAddress: site.address || undefined,
      },
    });
  }

  if (hasOffer) {
    graph.push({
      '@type': 'Offer',
      '@id': `${url}#offer`,
      url,
      priceCurrency: 'KRW',
      ...(site.price_min ? { lowPrice: site.price_min * 10000 } : {}),
      ...(site.price_max ? { highPrice: site.price_max * 10000 } : {}),
      ...(site.price_min ? { price: site.price_min * 10000 } : {}),
      availability: 'https://schema.org/PreOrder',
      ...(site.move_in_date ? { validThrough: site.move_in_date } : {}),
    });
  }

  if (hasRating) {
    graph.push({
      '@type': 'AggregateRating',
      '@id': `${url}#rating`,
      itemReviewed: { '@id': `${url}#apartment` },
      ratingValue: Number(site.review_score),
      reviewCount: site.review_count,
      bestRating: 5,
      worstRating: 1,
    });
  }

  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '카더라', item: origin },
      { '@type': 'ListItem', position: 2, name: '부동산', item: `${origin}/apt` },
      ...(site.region ? [{ '@type': 'ListItem', position: 3, name: site.region, item: `${origin}/apt/region/${encodeURIComponent(site.region)}` }] : []),
      { '@type': 'ListItem', position: site.region ? 4 : 3, name: site.name, item: url },
    ],
  });

  if (cards.length > 0) {
    graph.push({
      '@type': 'ImageGallery',
      '@id': `${url}#gallery`,
      name: `${site.name} ${stLabel} 카드`,
      url,
      image: cards.map(c => ({
        '@type': 'ImageObject',
        url: c.url.startsWith('http') ? c.url : `${origin}${c.url}`,
        width: 630,
        height: 630,
        caption: c.alt || site.name,
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
