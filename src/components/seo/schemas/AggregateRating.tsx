import JsonLd from '../JsonLd';

interface Props {
  itemName: string;
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

export default function AggregateRatingSchema({ itemName, ratingValue, reviewCount, bestRating = 5, worstRating = 1 }: Props) {
  if (reviewCount < 1 || ratingValue <= 0) return null;
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'AggregateRating',
        itemReviewed: { '@type': 'Thing', name: itemName },
        ratingValue: Number(ratingValue.toFixed(2)),
        reviewCount,
        bestRating,
        worstRating,
      }}
    />
  );
}
