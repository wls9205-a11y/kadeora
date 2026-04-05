import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

/**
 * 재건축/재개발 PDF에서 총세대수(단지 전체 규모) 추출
 * 공급세대수(일반+특별)와 다른 "단지 전체 세대수"를 찾음
 */
async function extractTotalHH(
  apt: { id: number; house_nm: string; announcement_pdf_url: string; tot_supply_hshld_co: number },
  pdfParse: any,
  sb: any
): Promise<{ ok: boolean; totalHH: number | null }> {
  try {
    const res = await fetch(apt.announcement_pdf_url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return { ok: false, totalHH: null };

    const buf = Buffer.from(await res.arrayBuffer());
    const pdf = await pdfParse(buf, { max: 10 }); // 더 많은 페이지 읽기
    const text: string = pdf.text || '';
    if (text.length < 100) return { ok: false, totalHH: null };

    const supply = apt.tot_supply_hshld_co || 0;
    const num = (s: string): number => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;

    // 패턴 1: "전체 X,XXX세대 중 일반분양 Y세대" / "X세대 중 Y세대를 일반분양"
    const p1 = text.match(/(?:전체|총)\s*([0-9,]+)\s*세대\s*중\s*(?:일반\s*분양|금회\s*분양|이번\s*분양)\s*([0-9,]+)/i);
    if (p1) {
      const total = num(p1[1]);
      const general = num(p1[2]);
      if (total > supply && total > general) {
        await (sb as any).from('apt_subscriptions').update({ total_households: total }).eq('id', apt.id);
        return { ok: true, totalHH: total };
      }
    }

    // 패턴 2: "조합원 X + 일반분양 Y = 총 Z세대" / "조합원분양 X세대, 일반분양 Y세대"
    const p2 = text.match(/조합원\s*(?:분양)?\s*([0-9,]+)\s*세대[\s,·+]+일반\s*(?:분양)?\s*([0-9,]+)/i);
    if (p2) {
      const union = num(p2[1]);
      const general = num(p2[2]);
      const total = union + general;
      if (total > supply) {
        await (sb as any).from('apt_subscriptions').update({ total_households: total }).eq('id', apt.id);
        return { ok: true, totalHH: total };
      }
    }

    // 패턴 3: "사업규모 : N개동 X,XXX세대" / "사업(계획)규모"
    const p3 = text.match(/사업\s*(?:계획\s*)?규모\s*[:\s]*(?:\d{1,3}\s*개?\s*동[\s,]*)?([0-9,]+)\s*세대/i);
    if (p3) {
      const total = num(p3[1]);
      if (total > supply && total > 50) {
        await (sb as any).from('apt_subscriptions').update({ total_households: total }).eq('id', apt.id);
        return { ok: true, totalHH: total };
      }
    }

    // 패턴 4: "총세대수 : X,XXX세대" (앞 컨텍스트에 "공급/금회" 없을 때)
    const hhPats = [
      /총\s*세대\s*수\s*[:\s]*([0-9,]+)\s*세대/i,
      /총\s*세대\s*수\s*[:\s]*([0-9,]+)/i,
      /계획\s*세대\s*수?\s*[:\s]*([0-9,]+)/i,
    ];
    for (const pat of hhPats) {
      const m = text.match(pat);
      if (m) {
        const idx = text.indexOf(m[0]);
        const before = text.slice(Math.max(0, idx - 30), idx);
        if (!/(?:공급|금회|이번|분양|일반)\s*(?:대상)?/i.test(before)) {
          const total = num(m[1]);
          if (total > supply && total > 50) {
            await (sb as any).from('apt_subscriptions').update({ total_households: total }).eq('id', apt.id);
            return { ok: true, totalHH: total };
          }
        }
      }
    }

    // 패턴 5: "X,XXX세대 규모의 단지/아파트"
    const p5 = text.match(/([0-9,]+)\s*세대\s*규모\s*(?:의\s*)?(?:단지|아파트|대단지|주거단지)/i);
    if (p5) {
      const total = num(p5[1]);
      if (total > supply && total > 50) {
        await (sb as any).from('apt_subscriptions').update({ total_households: total }).eq('id', apt.id);
        return { ok: true, totalHH: total };
      }
    }

    // 패턴 6: "N개동 X,XXX세대" (사업개요 섹션 근처)
    const p6 = text.match(/(\d{1,3})\s*개?\s*동[\s,·]*([0-9,]+)\s*세대/i);
    if (p6) {
      const total = num(p6[2]);
      // 사업개요/단지개요 근처에 있고, 공급세대보다 큰 경우
      const idx = text.indexOf(p6[0]);
      const nearby = text.slice(Math.max(0, idx - 100), idx);
      if (/(?:사업\s*개요|단지\s*개요|사업\s*규모|건축\s*개요)/i.test(nearby) && total > supply && total > 50) {
        await (sb as any).from('apt_subscriptions').update({ total_households: total }).eq('id', apt.id);
        return { ok: true, totalHH: total };
      }
    }

    return { ok: true, totalHH: null }; // 파싱 성공했지만 총세대수 못 찾음
  } catch {
    return { ok: false, totalHH: null };
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const isAuthed = token === process.env.CRON_SECRET || authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return runExtraction();
}

export async function POST() {
  return runExtraction();
}

async function runExtraction() {

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const sb = getSupabaseAdmin();

  // 재건축/재개발 중 총세대수 미보유 + PDF URL 있는 건
  const { data: targets } = await (sb as any).from('apt_subscriptions')
    .select('id, house_nm, announcement_pdf_url, tot_supply_hshld_co')
    .not('announcement_pdf_url', 'is', null).neq('announcement_pdf_url', '')
    .in('project_type', ['재건축', '재개발'])
    .or('total_households.is.null,total_households.eq.0')
    .order('tot_supply_hshld_co', { ascending: false })
    .limit(100);

  if (!targets?.length) return NextResponse.json({ ok: true, message: '재건축/재개발 총세대수 파싱 완료!', remaining: 0 });

  const { count: remaining } = await (sb as any).from('apt_subscriptions')
    .select('id', { count: 'exact', head: true })
    .not('announcement_pdf_url', 'is', null)
    .in('project_type', ['재건축', '재개발'])
    .or('total_households.is.null,total_households.eq.0');

  let processed = 0, found = 0, failed = 0;
  const foundList: string[] = [];

  const CONCURRENCY = 8;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((apt: any) => extractTotalHH(apt, pdfParse, sb))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled') {
        if (r.value.ok) {
          processed++;
          if (r.value.totalHH) {
            found++;
            foundList.push(`${chunk[j].house_nm}: ${r.value.totalHH}세대`);
          }
        } else { failed++; }
      } else { failed++; }
    }
  }

  return NextResponse.json({
    ok: true, processed, found, failed,
    batch: targets.length,
    remaining: (remaining || 0) - targets.length,
    foundList: foundList.slice(0, 20),
  });
}
