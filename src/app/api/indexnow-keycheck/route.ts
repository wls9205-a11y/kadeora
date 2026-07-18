// TEMP DIAGNOSTIC — 배포 런타임에서 INDEXNOW_KEY 가 실제로 무엇으로 resolve 되는지 확인.
// IndexNow 키는 공개키(호스팅 .txt)라 노출 위험 없음. 확인 후 즉시 제거한다.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOSTED_FALLBACK = '3a23def313e1b1283822c54a0f9a5675';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export async function GET() {
  const envKey = process.env.INDEXNOW_KEY || null;
  const resolvedKey = process.env.INDEXNOW_KEY || HOSTED_FALLBACK;

  let txtStatus = 0;
  let txtBody = '';
  let matches = false;
  try {
    const r = await fetch(`${SITE}/${resolvedKey}.txt`, { signal: AbortSignal.timeout(8000) });
    txtStatus = r.status;
    txtBody = (await r.text()).trim();
    matches = txtBody === resolvedKey;
  } catch { /* leave defaults */ }

  return NextResponse.json({
    branch: envKey ? 'A (env set — env가 fallback 을 이김)' : 'B (env 미설정 — fallback 사용)',
    envKeyPresent: !!envKey,
    envKeyPrefix: envKey ? envKey.slice(0, 8) : null,
    resolvedKeyPrefix: resolvedKey.slice(0, 8),
    resolvedTxt: {
      url: `${SITE}/${resolvedKey}.txt`,
      status: txtStatus,
      matchesResolvedKey: matches,
      bodyPrefix: txtBody.slice(0, 8),
    },
    verdict: txtStatus === 200 && matches
      ? 'OK — 코드 최종 키 == 호스팅 .txt (byte-exact), no-op 없음'
      : 'MISMATCH — resolved 키의 .txt 미호스팅/불일치 → no-op 위험',
  });
}
