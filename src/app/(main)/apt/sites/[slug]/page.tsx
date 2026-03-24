import { permanentRedirect } from 'next/navigation';

interface Props { params: Promise<{ slug: string }> }

export default async function SiteSlugRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(`/apt/${slug}`);
}
