import JsonLd from '../JsonLd';

interface FaqItem { q: string; a: string; }
interface Props { faqs: FaqItem[]; }

export default function FAQPageSchema({ faqs }: Props) {
  const valid = (faqs || []).filter((f) => f && f.q && f.a);
  if (valid.length === 0) return null;
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: valid.map((f) => ({
          '@type': 'Question',
          name: f.q.slice(0, 300),
          acceptedAnswer: { '@type': 'Answer', text: f.a.slice(0, 1000) },
        })),
      }}
    />
  );
}
