import JsonLd from '../JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

interface Props {
  symbol: string;
  name: string;
  lastPrice?: number | null;
  currency?: string;
  description?: string;
}

export default function FinancialProductSchema({ symbol, name, lastPrice, currency, description }: Props) {
  const url = `${SITE_URL}/stock/${encodeURIComponent(symbol)}`;
  return (
    <JsonLd
      data={[
        {
          '@context': 'https://schema.org',
          '@type': 'FinancialProduct',
          name,
          url,
          category: 'stock',
          ...(description ? { description: description.slice(0, 300) } : {}),
          provider: { '@type': 'Organization', name: '카더라', url: SITE_URL },
          ...(lastPrice != null
            ? {
                offers: {
                  '@type': 'Offer',
                  price: lastPrice,
                  priceCurrency: currency || 'KRW',
                },
              }
            : {}),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Corporation',
          name,
          tickerSymbol: symbol,
          url,
        },
      ]}
    />
  );
}
