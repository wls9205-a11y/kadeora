/**
 * A6 — 「본부장 노트」. 담당이 직접 쓴 현장 글 최신 1편.
 *
 * ⚠️ 0건이면 «렌더하지 않는다». 자리를 만들어 놓고 비워 두면 「없는 것」이 아니라
 *    「고장난 것」으로 읽힌다.
 * ⚠️ 실명을 쓰지 않는다 — 역할만 밝힌다.
 * ⛔ 자동 생성 글을 여기 올리지 않는다. category='field_note' «만» 이다.
 *    섞이는 순간 「담당이 봤다」가 거짓이 된다.
 */

import Link from 'next/link';

export interface FieldNoteRow {
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
}

function md(d: string | null): string {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return m && day ? `${Number(m)}월 ${Number(day)}일` : '';
}

export default function FieldNote({ note }: { note: FieldNoteRow | null }) {
  if (!note) return null;

  return (
    <section className="apt-card field-note" aria-labelledby="apt-note-h">
      <h2 id="apt-note-h" className="field-note__h">
        본부장 노트
        {note.published_at && <span className="field-note__d">{md(note.published_at)}</span>}
      </h2>
      <Link href={`/blog/${encodeURIComponent(note.slug)}`} className="field-note__t">{note.title}</Link>
      {note.excerpt && <p className="field-note__x">{note.excerpt}</p>}
    </section>
  );
}
