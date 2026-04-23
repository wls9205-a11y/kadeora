import JsonLd from '../JsonLd';

interface Props {
  url: string;
  caption?: string;
  width?: number;
  height?: number;
}

export default function ImageObjectSchema({ url, caption, width, height }: Props) {
  if (!url) return null;
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'ImageObject',
        url,
        contentUrl: url,
        ...(caption ? { caption: caption.slice(0, 200) } : {}),
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      }}
    />
  );
}
