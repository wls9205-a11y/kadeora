'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';

interface PredictionData {
  participantCount: number;
  avgPrediction: number;
  currentKospi: number;
  weekStart: string;
  daysLeft: number;
  myPrediction: number | null;
  lastWeekTop3: { nickname: string; prediction: number; diff: number }[];
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}

function getFriday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = 5 - day + (day === 0 ? -2 : day > 5 ? 7 : 0);
  const fri = new Date();
  fri.setDate(fri.getDate() + diff);
  fri.setHours(15, 30, 0, 0);
  return fri;
}

export default function WeeklyPrediction() {
  const { userId } = useAuth();
  const [data, setData] = useState<PredictionData | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      const sb = createSupabaseBrowser();
      const weekStart = getMonday();
      const fri = getFriday();
      const daysLeft = Math.max(0, Math.ceil((fri.getTime() - Date.now()) / 86400000));

      // 현재 코스피 (KOSPI 인덱스 또는 대표 ETF)
      const { data: kospiRow } = await sb.from('stock_quotes')
        .select('price').eq('symbol', 'KODEX200').single();
      const currentKospi = kospiRow ? Math.round(Number(kospiRow.price)) : 2584;

      // 이번주 참여자 수 + 평균
      const { data: predictions, count } = await (sb as any).from('weekly_predictions')
        .select('prediction', { count: 'exact' })
        .eq('week_start', weekStart);
      const preds = (predictions || []).map((p: any) => Number(p.prediction));
      const avg = preds.length > 0 ? Math.round(preds.reduce((a: number, b: number) => a + b, 0) / preds.length) : 0;

      // 내 예측
      let myPred: number | null = null;
      if (userId) {
        const { data: myRow } = await (sb as any).from('weekly_predictions')
          .select('prediction').eq('user_id', userId).eq('week_start', weekStart).single();
        if (myRow) myPred = Number(myRow.prediction);
      }

      // 지난주 TOP 3
      const lastMonday = new Date();
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lmDay = lastMonday.getDay();
      lastMonday.setDate(lastMonday.getDate() - lmDay + (lmDay === 0 ? -6 : 1));
      const lastWeekStr = lastMonday.toISOString().slice(0, 10);

      const { data: topRows } = await (sb as any).from('weekly_predictions')
        .select('prediction, diff, profiles!weekly_predictions_user_id_fkey(nickname)')
        .eq('week_start', lastWeekStr)
        .not('diff', 'is', null)
        .order('diff', { ascending: true })
        .limit(3);

      const top3 = (topRows || []).map((r: any) => ({
        nickname: r.profiles?.nickname || '익명',
        prediction: Number(r.prediction),
        diff: Math.abs(Number(r.diff)),
      }));

      setData({ participantCount: count || 0, avgPrediction: avg, currentKospi, weekStart, daysLeft, myPrediction: myPred, lastWeekTop3: top3 });
      if (myPred) setSubmitted(true);
    };
    load();
  }, [userId]);

  const handleSubmit = async () => {
    if (!userId || !inputVal || submitting) return;
    const val = Number(inputVal);
    if (isNaN(val) || val < 1000 || val > 5000) return;
    setSubmitting(true);
    const sb = createSupabaseBrowser();
    await (sb as any).from('weekly_predictions').upsert({
      user_id: userId,
      week_start: getMonday(),
      prediction: val,
    }, { onConflict: 'user_id,week_start' });

    // 포인트 지급 (첫 참여 시)
    if (!submitted) {
      try { await sb.rpc('award_points', { p_user_id: userId, p_amount: 10, p_reason: '코스피 예측 참여' }); } catch {}
    }
    setSubmitted(true);
    setSubmitting(false);
    if (data) setData({ ...data, myPrediction: val, participantCount: data.participantCount + (submitted ? 0 : 1) });
  };

  if (!data) return null;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-yellow)' }}>이번주 코스피 예측</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>D-{data.daysLeft} 마감</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-sm)' }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '6px 0' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>현재</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{data.currentKospi.toLocaleString()}</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ flex: 1, textAlign: 'center', padding: '6px 0' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>평균 예측</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-yellow)' }}>{data.avgPrediction > 0 ? data.avgPrediction.toLocaleString() : '—'}</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ flex: 1, textAlign: 'center', padding: '6px 0' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>참여</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{data.participantCount}</div>
        </div>
      </div>

      {submitted && data.myPrediction ? (
        <div style={{ padding: '8px 10px', background: 'var(--bg-hover)', borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>내 예측: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{data.myPrediction.toLocaleString()}</span></span>
          <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>✓ 참여 완료 +10P</span>
        </div>
      ) : userId ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input type="number" placeholder="금요일 종가 예측"
            value={inputVal} onChange={e => setInputVal(e.target.value)}
            style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          <button onClick={handleSubmit} disabled={submitting}
            style={{ height: 34, padding: '0 14px', borderRadius: 8, background: 'var(--accent-yellow)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: submitting ? 0.6 : 1 }}>
            참여 +10P
          </button>
        </div>
      ) : null}

      {data.lastWeekTop3.length > 0 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {data.lastWeekTop3.map((t, i) => (
            <div key={i} style={{ flex: 1, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-hover)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{medals[i]} {t.nickname}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>오차 {t.diff}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
