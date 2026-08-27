'use client';
/**
 * A6 — 「더 알고 싶음」 버튼 하나.
 *
 * ⚠️ 집계만 한다. 이번 커밋에서 «이 값을 쓰는 곳은 없다» — Phase B4 의 digest 가
 *    24시간 3건 이상을 첫 항목으로 올릴 때 처음 쓰인다.
 *    지금 순위나 정렬에 쓰지 않는다. 신호가 쌓이기 전에 쓰면 그게 곧 가짜 순위다.
 *
 * ⚠️ 버튼은 «하나» 다. 여러 감정을 고르게 하면 무엇을 물어본 건지 흐려진다.
 * ⚠️ 비로그인은 누를 수 없다. 익명 집계는 봇과 사람을 구분하지 못한다 —
 *    그 값으로는 아무 판단도 못 한다.
 */

import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function ObservationReaction({
  observationId,
  initialOn = false,
}: {
  observationId: number;
  initialOn?: boolean;
}) {
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      // ⚠️ types/database.ts 는 «보호 대상» 이라 새 컬럼(observation_id·target_type)이
      //    생성 타입에 없다. 리포 다른 곳(apt_sites 조회 등)과 같은 as any 패턴을 쓴다.
      const sb = createSupabaseBrowser() as any;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setNote('로그인이 필요합니다'); return; }

      if (on) {
        const { error } = await sb.from('post_reactions').delete()
          .eq('observation_id', observationId).eq('user_id', user.id);
        if (error) { console.error('[obs-reaction] delete', error.message); setNote('잠시 후 다시'); return; }
        setOn(false);
      } else {
        // ⚠️ target_type 을 반드시 넣는다 — CHECK 가 「둘 중 정확히 하나」를 강제한다.
        const { error } = await sb.from('post_reactions').insert({
          observation_id: observationId, user_id: user.id,
          reaction: 'useful', target_type: 'observation', post_id: null,
        });
        if (error) { console.error('[obs-reaction] insert', error.message); setNote('잠시 후 다시'); return; }
        setOn(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="obs-react">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} className="obs-react__btn">
        더 알고 싶음
      </button>
      {note && <span className="obs-react__note">{note}</span>}
    </span>
  );
}
