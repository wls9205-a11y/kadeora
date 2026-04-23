type SchemaType =
  | 'BlogPosting'
  | 'Article'
  | 'NewsArticle'
  | 'RealEstateListing'
  | 'Residence'
  | 'Product'
  | 'FinancialProduct';

export function PaywallMarker({
  hasGatedContent,
  schemaType,
  cssSelector = '.kadeora-paywall',
}: {
  hasGatedContent: boolean;
  schemaType: SchemaType;
  cssSelector?: string;
}) {
  if (!hasGatedContent) return null;

  const ld = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    isAccessibleForFree: false,
    hasPart: {
      '@type': 'WebPageElement',
      isAccessibleForFree: false,
      cssSelector,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
