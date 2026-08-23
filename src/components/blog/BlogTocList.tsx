// v3 커밋6 — 블로그 목차 세로 목록.
//
// 데스크탑은 우측 레일에서, 모바일은 <details> 안에서 같은 목록을 쓴다.
// 클라이언트 JS 없이 순수 앵커다 — 이동 위치는 blog.css 의
// `.blog-content h2/h3 { scroll-margin-top }` 이 받는다.
// (기존 BlogToc 의 sticky 칩 바는 본문 폭을 먹어 v3 에서 이 목록으로 대체했다.)

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

function clean(text: string) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s*/u, '');
}

export default function BlogTocList({ toc }: { toc: TocItem[] }) {
  const items = toc.filter(t => t.level === 2 || t.level === 3);
  if (items.length < 2) return null;

  return (
    <nav aria-label="목차">
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', counterReset: 'kd-toc' }}>
        {items.map(item => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              style={{
                display: 'block',
                padding: item.level === 3 ? '6px 0 6px 14px' : '7px 0',
                fontSize: item.level === 3 ? 11.5 : 12.5,
                fontWeight: item.level === 3 ? 500 : 600,
                lineHeight: 1.45,
                color: item.level === 3 ? 'var(--text-secondary)' : 'var(--text-primary)',
                textDecoration: 'none',
                wordBreak: 'keep-all',
              }}
            >
              {clean(item.text)}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
