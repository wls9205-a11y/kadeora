import JsonLd from '../JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

interface Props {
  name: string;
  slug: string;
  address?: string;
  price?: number | null;
  priceUnit?: string;
  totalArea?: number | null;
  totalUnits?: number | null;
  image?: string;
}

export default function RealEstateListingSchema({ name, slug, address, price, priceUnit, totalArea, totalUnits, image }: Props) {
  const url = `${SITE_URL}/apt/${encodeURIComponent(slug)}`;
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name,
        url,
        ...(image ? { image } : {}),
        ...(address
          ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: address,
                addressCountry: 'KR',
              },
            }
          : {}),
        ...(price != null
          ? {
              offers: {
                '@type': 'Offer',
                price,
                priceCurrency: priceUnit || 'KRW',
                availability: 'https://schema.org/InStock',
              },
            }
          : {}),
        ...(totalArea ? { floorSize: { '@type': 'QuantitativeValue', value: totalArea, unitCode: 'MTK' } } : {}),
        ...(totalUnits ? { numberOfRooms: totalUnits } : {}),
      }}
    />
  );
}
