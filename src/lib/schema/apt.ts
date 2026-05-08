import { SITE_URL } from '@/lib/constants';

export interface AptForSchema {
  id: string | number;
  slug?: string | null;
  name: string;
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
  status?: string | null;
  faq_items?: Array<{ q: string; a: string }> | null;
  key_features?: string[] | null;
  images?: Array<string | { url: string; caption?: string | null }> | null;
}

type JsonLd = Record<string, unknown>;

function urlFor(slug: string | null | undefined): string {
  return `${SITE_URL}/apt/${encodeURIComponent(slug || '')}`;
}

// s236 W9: filter satellite/og + sort by priority for schema images
function buildSchemaImages(images: AptForSchema['images']): JsonLd[] | undefined {
  if (!images || !Array.isArray(images) || images.length === 0) return undefined;
  const objs = images
    .map(img => typeof img === 'string' ? { url: img, caption: undefined as string | null | undefined } : img)
    .filter((img): img is { url: string; caption?: string | null } => !!img && !!img.url)
    .filter(img => !/maps\.googleapis|staticmap|openstreetmap|\/satellite\/|aerial.view|satellite.image/i.test(img.url))
    .filter(img => !(img.caption && /위성사진|aerial.view|satellite.image/i.test(img.caption)))
    .sort((a, b) => {
      const score = (img: { url: string; caption?: string | null }) => {
        const c = img.caption || '';
        if (/조감도|투시도|rendering|birdseye/i.test(c)) return 1;
        if (/모델하우스|견본|평면도|배치도/i.test(c)) return 2;
        if (/현장|건설|공사|시공/i.test(c)) return 3;
        if (/imgnews\.naver|pstatic|kakaocdn|daumcdn/i.test(img.url)) return 4;
        if (/kadeora\.app\/api\/og/i.test(img.url)) return 9;
        return 5;
      };
      return score(a) - score(b);
    });
  if (objs.length === 0) return undefined;
  return objs.map(img => ({
    '@type': 'ImageObject',
    contentUrl: img.url,
    ...(img.caption ? { caption: img.caption } : {}),
  }));
}

function buildRealEstateListing(apt: AptForSchema): JsonLd {
  const url = urlFor(apt.slug);
  const offers =
    apt.price_min || apt.price_max
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'KRW',
          ...(apt.price_min ? { lowPrice: apt.price_min * 10000 } : {}),
          ...(apt.price_max ? { highPrice: apt.price_max * 10000 } : {}),
          offerCount: apt.total_units || 1,
        }
      : undefined;
  const schemaImages = buildSchemaImages(apt.images);

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: apt.name,
    description: apt.description || `${apt.region || ''} ${apt.name}`,
    url,
    address: {
      '@type': 'PostalAddress',
      addressRegion: apt.region || '',
      addressLocality: apt.sigungu || '',
      streetAddress: apt.address || '',
      addressCountry: 'KR',
    },
    ...(apt.total_units ? { numberOfRooms: apt.total_units } : {}),
    ...(apt.latitude && apt.longitude
      ? { geo: { '@type': 'GeoCoordinates', latitude: apt.latitude, longitude: apt.longitude } }
      : {}),
    ...(apt.builder ? { brand: { '@type': 'Organization', name: apt.builder } } : {}),
    ...(offers ? { offers } : {}),
    ...(schemaImages ? { image: schemaImages } : {}),
  };
}

function buildItemList(apt: AptForSchema): JsonLd {
  const items: JsonLd[] = [];
  let pos = 1;
  if (apt.region) {
    items.push({
      '@type': 'ListItem',
      position: pos++,
      name: '지역',
      value: [apt.region, apt.sigungu, apt.dong].filter(Boolean).join(' '),
    });
  }
  if (apt.builder) items.push({ '@type': 'ListItem', position: pos++, name: '시공사', value: apt.builder });
  if (apt.total_units)
    items.push({ '@type': 'ListItem', position: pos++, name: '세대수', value: `${apt.total_units}세대` });
  if (apt.price_min || apt.price_max) {
    const priceText =
      apt.price_min && apt.price_max
        ? `${apt.price_min.toLocaleString()} ~ ${apt.price_max.toLocaleString()}만원`
        : `${(apt.price_min || apt.price_max || 0).toLocaleString()}만원`;
    items.push({ '@type': 'ListItem', position: pos++, name: '분양가', value: priceText });
  }
  if (apt.status) items.push({ '@type': 'ListItem', position: pos++, name: '상태', value: apt.status });

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${apt.name} 핵심 정보`,
    itemListElement: items,
  };
}

function buildFaqPage(apt: AptForSchema): JsonLd | null {
  const faq = apt.faq_items;
  if (!faq || !Array.isArray(faq) || faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

function buildBreadcrumb(apt: AptForSchema): JsonLd {
  const elements: JsonLd[] = [
    { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
  ];
  if (apt.region) {
    elements.push({
      '@type': 'ListItem',
      position: 3,
      name: apt.region,
      item: `${SITE_URL}/apt/region/${encodeURIComponent(apt.region)}`,
    });
  }
  elements.push({
    '@type': 'ListItem',
    position: apt.region ? 4 : 3,
    name: apt.name,
    item: urlFor(apt.slug),
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: elements,
  };
}

export function buildAptJsonLd(apt: AptForSchema): JsonLd[] {
  const out: JsonLd[] = [
    buildRealEstateListing(apt),
    buildItemList(apt),
    buildBreadcrumb(apt),
  ];
  const faq = buildFaqPage(apt);
  if (faq) out.push(faq);
  return out;
}
