// components/apt/AptSubscriptionStructuredData.tsx
import type { AptSiteData, AptSubscriptionRaw } from '@/lib/apt-subscription-meta';

export function AptSubscriptionStructuredData({
  s,
  sub,
}: {
  s: AptSiteData;
  sub?: AptSubscriptionRaw | null;
}) {
  const faqs = s.faqs || s.faq_items || [];
  const baseUrl = 'https://kadeora.app';
  const pageUrl = `${baseUrl}/apt/${encodeURIComponent(s.slug)}`;

  const graph: Array<unknown> = [
    {
      '@type': 'Apartment',
      '@id': `${pageUrl}#apt`,
      name: s.name,
      alternateName: s.name_variants || [],
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'KR',
        addressRegion: s.region || undefined,
        addressLocality: s.sigungu || undefined,
        streetAddress: s.address || undefined,
      },
      ...(s['latitude'] && s['longitude']
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: s['latitude'],
              longitude: s['longitude'],
            },
          }
        : {}),
      ...(s.total_units ? { numberOfRooms: s.total_units } : {}),
      url: pageUrl,
      image: s.cover_image_url || s.og_image_url || undefined,
    },
    s.address && {
      '@type': 'Place',
      '@id': `${pageUrl}#modelhouse`,
      name: `${s.name} 모델하우스`,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'KR',
        streetAddress: s.address,
      },
      ...(s.model_house_lat && s.model_house_lng
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: s.model_house_lat,
              longitude: s.model_house_lng,
            },
          }
        : {}),
    },
    sub?.rcept_bgnde && {
      '@type': 'Event',
      name: `${s.name} 1순위 청약`,
      startDate: sub.rcept_bgnde,
      ...(sub.rcept_endde ? { endDate: sub.rcept_endde } : {}),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      organizer: { '@type': 'Organization', name: s.builder || '시공사' },
      location: { '@type': 'VirtualLocation', url: 'https://www.applyhome.co.kr/' },
      ...(sub.pblanc_url ? { url: sub.pblanc_url } : {}),
    },
    s.price_min &&
      s.price_max && {
        '@type': 'Offer',
        priceCurrency: 'KRW',
        priceSpecification: [
          {
            '@type': 'PriceSpecification',
            minPrice: s.price_min * 10000,
            maxPrice: s.price_max * 10000,
            priceCurrency: 'KRW',
          },
        ],
      },
    faqs.length > 0 && {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '카더라', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: '부동산', item: `${baseUrl}/apt` },
        { '@type': 'ListItem', position: 3, name: '분양', item: `${baseUrl}/apt` },
        s.region && { '@type': 'ListItem', position: 4, name: s.region },
        s.sigungu && { '@type': 'ListItem', position: 5, name: s.sigungu },
        { '@type': 'ListItem', position: 6, name: s.name, item: pageUrl },
      ].filter(Boolean),
    },
  ];

  const filtered = graph.filter(
    (g): g is Record<string, unknown> => Boolean(g) && typeof g === 'object',
  );

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': filtered }),
      }}
    />
  );
}
