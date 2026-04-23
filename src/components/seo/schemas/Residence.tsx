import JsonLd from '../JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

interface Props {
  name: string;
  slug: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  image?: string;
  builtYear?: number | null;
  totalUnits?: number | null;
}

export default function ResidenceSchema({ name, slug, address, latitude, longitude, image, builtYear, totalUnits }: Props) {
  const url = `${SITE_URL}/apt/complex/${encodeURIComponent(slug)}`;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Residence',
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
    ...(latitude != null && longitude != null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude,
            longitude,
          },
        }
      : {}),
    ...(totalUnits ? { numberOfRooms: totalUnits } : {}),
    ...(builtYear
      ? {
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'yearBuilt', value: String(builtYear) },
          ],
        }
      : {}),
  };
  return <JsonLd data={data} />;
}
