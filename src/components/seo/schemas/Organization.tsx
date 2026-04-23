import JsonLd from '../JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export default function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '카더라',
        alternateName: 'Kadeora',
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-192.png`,
        sameAs: [
          'https://blog.naver.com/kadeora',
          'https://www.facebook.com/kadeora',
          'https://www.instagram.com/kadeora',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'kadeora.app@gmail.com',
          contactType: 'customer support',
          availableLanguage: ['ko'],
        },
      }}
    />
  );
}
