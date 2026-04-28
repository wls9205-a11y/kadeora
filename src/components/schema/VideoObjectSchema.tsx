import React from 'react';

/**
 * VideoObjectSchema — 본문에 포함된 YouTube 영상의 VideoObject JSON-LD.
 *  videos 0 개면 null 반환 (마운트 자체 안 함).
 */

export interface VideoItem {
  url: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  uploadDate?: string;
  duration?: string; // ISO 8601 e.g. PT1M30S
}

interface Props {
  videos: VideoItem[];
}

export default function VideoObjectSchema({ videos }: Props) {
  if (!videos || videos.length === 0) return null;

  const list = videos.map(v => ({
    '@type': 'VideoObject',
    name: v.name,
    ...(v.description ? { description: v.description } : {}),
    contentUrl: v.url,
    embedUrl: v.url,
    ...(v.thumbnailUrl ? { thumbnailUrl: v.thumbnailUrl } : {}),
    ...(v.uploadDate ? { uploadDate: v.uploadDate } : {}),
    ...(v.duration ? { duration: v.duration } : {}),
  }));

  const payload =
    list.length === 1
      ? { '@context': 'https://schema.org', ...list[0] }
      : { '@context': 'https://schema.org', '@graph': list };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}

/**
 * 본문 (마크다운/HTML) 에서 YouTube 11자리 ID 추출 후 VideoItem[] 으로 반환.
 *  - youtube.com/embed/ID
 *  - youtube.com/watch?v=ID
 *  - youtu.be/ID
 *  thumbnail = img.youtube.com/vi/ID/maxresdefault.jpg
 */
export function extractVideosFromContent(content: string, fallbackName: string): VideoItem[] {
  if (!content) return [];
  const ids = new Set<string>();
  const patterns = [
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/g,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/g,
    /youtu\.be\/([A-Za-z0-9_-]{11})/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) ids.add(m[1]);
  }

  const items: VideoItem[] = [];
  for (const id of ids) {
    items.push({
      url: `https://www.youtube.com/embed/${id}`,
      name: fallbackName,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    });
  }
  return items;
}
