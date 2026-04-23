import JsonLd from '../JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

interface Crumb { name: string; url: string; }
interface Props { items: Crumb[]; }

export default function BreadcrumbListSchema({ items }: Props) {
  if (!items || items.length === 0) return null;
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: c.url.startsWith('http') ? c.url : `${SITE_URL}${c.url.startsWith('/') ? '' : '/'}${c.url}`,
        })),
      }}
    />
  );
}
