import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

/**
 * PDF 가격 정밀 파싱 크론
 * 
 * 모집공고 PDF에서 층별 공급금액 + 규제 + 시설 + 설계 정보 추출
 * 정규식 5패턴 + Haiku AI 폴백 + API 교차검증
 * 
 * 배치: 1,000건/실행, 동시 30건
 * GOD MODE에서 수동 실행 가능
 */

const num = (s: string): number => {
  const n = parseInt(s.replace(/[^0-9]/g, ''));
  return isNaN(n) ? 0 : n;
};

// ─── 가격 테이블 파싱 (5패턴) ───

interface FloorPrice { range: string; price: number }
interface PriceResult {
  min: number; avg: number; max: number;
  floor_prices: FloorPrice[];
  source: 'regex' | 'ai';
}

function parsePriceTable(text: string, typeStr: string, apiMax: number): PriceResult | null {
  if (apiMax <= 0) return null;

  const prices: number[] = [];
  const apiMaxStr = apiMax.toLocaleString(); // "47,000" 형태
  const apiMaxRaw = String(apiMax); // "47000" 형태

  // 전략 1: API 최고가 값을 PDF 텍스트에서 직접 찾고, 주변 ±500자에서 같은 범위 숫자 추출
  const maxIdx = text.indexOf(apiMaxStr) !== -1 ? text.indexOf(apiMaxStr) : text.indexOf(apiMaxRaw);
  if (maxIdx !== -1) {
    const around = text.slice(Math.max(0, maxIdx - 300), maxIdx + 300);
    const nums = around.match(/[\d,]{4,}/g);
    if (nums) {
      for (const n of nums) {
        const v = num(n);
        // API 최고가의 60~105% 범위 (저층은 최고가의 60% 이상)
        if (v >= apiMax * 0.6 && v <= apiMax * 1.05 && !prices.includes(v)) prices.push(v);
      }
    }
  }

  // 전략 2: "공급금액" / "분양가격" / "공급가격" 섹션에서 가격 범위 숫자 추출
  if (prices.length < 2) {
    const sectionPats = [/공급금액[\s\S]{0,800}/i, /분양가격[\s\S]{0,800}/i, /공급가격[\s\S]{0,800}/i, /층별\s*금액[\s\S]{0,800}/i];
    for (const sp of sectionPats) {
      const m = text.match(sp);
      if (m) {
        const nums = m[0].match(/[\d,]{4,}/g);
        if (nums) {
          for (const n of nums) {
            const v = num(n);
            if (v >= apiMax * 0.6 && v <= apiMax * 1.05 && !prices.includes(v)) prices.push(v);
          }
        }
        if (prices.length >= 2) break;
      }
    }
  }

  // 전략 3: 타입 축약형 (84, 59, 74 등)으로 찾기
  if (prices.length < 2) {
    const typeShort = typeStr.replace(/[A-Za-z\s]/g, '').split('.')[0].replace(/^0+/, '');
    if (typeShort.length >= 2) {
      // "84" 또는 "084" 뒤 200자 내 가격 숫자
      const pat = new RegExp(`(?:${typeShort}|0${typeShort})[\\s\\S]{0,200}`, 'g');
      let tm;
      while ((tm = pat.exec(text)) !== null) {
        const nums = tm[0].match(/[\d,]{4,}/g);
        if (nums) {
          for (const n of nums) {
            const v = num(n);
            if (v >= apiMax * 0.6 && v <= apiMax * 1.05 && !prices.includes(v)) prices.push(v);
          }
        }
        if (prices.length >= 2) break;
      }
    }
  }

  // 전략 4: "최저" / "최고" 키워드
  if (prices.length < 2) {
    const minM = text.match(/최저[^\d]{0,20}?([\d,]{4,})/i);
    const maxM = text.match(/최고[^\d]{0,20}?([\d,]{4,})/i);
    if (minM) { const v = num(minM[1]); if (v >= 5000 && v <= 500000) prices.push(v); }
    if (maxM) { const v = num(maxM[1]); if (v >= 5000 && v <= 500000) prices.push(v); }
  }

  // 전략 5: 전체 텍스트에서 apiMax ± 20% 범위 숫자 전수 추출
  if (prices.length < 2) {
    const allNums = text.match(/[\d,]{4,}/g);
    if (allNums) {
      for (const n of allNums) {
        const v = num(n);
        if (v >= apiMax * 0.8 && v <= apiMax * 1.02 && v !== apiMax && !prices.includes(v)) {
          prices.push(v);
          if (prices.length >= 5) break; // 너무 많으면 중단
        }
      }
      // API 최고가도 포함
      if (!prices.includes(apiMax)) prices.push(apiMax);
    }
  }

  // API 최고가가 빠져있으면 추가
  if (prices.length > 0 && !prices.includes(apiMax)) prices.push(apiMax);

  if (prices.length < 2) return null;

  // 중복 제거 + 정렬
  const unique = [...new Set(prices)].sort((a, b) => a - b);
  const min = unique[0];
  const max = unique[unique.length - 1];
  const avg = Math.round(unique.reduce((s, p) => s + p, 0) / unique.length);

  // 교차검증: max가 API 최고가와 ±20% 이내
  if (Math.abs(max - apiMax) / apiMax > 0.20) return null;
  // min이 max보다 크면 오류
  if (min >= max) return null;
  // min이 max의 50% 미만이면 오류 (비현실적 차이)
  if (min < max * 0.5) return null;

  const floor_prices: FloorPrice[] = [];
  if (unique.length === 2) {
    floor_prices.push({ range: '저층', price: unique[0] }, { range: '고층', price: unique[1] });
  } else if (unique.length === 3) {
    floor_prices.push({ range: '저층', price: unique[0] }, { range: '중층', price: unique[1] }, { range: '고층', price: unique[2] });
  } else if (unique.length >= 4) {
    unique.forEach((p, i) => floor_prices.push({ range: `${i + 1}구간`, price: p }));
  }

  return { min, avg, max, floor_prices, source: 'regex' };
}

// ─── 규제 정보 파싱 ───

interface RegulationResult {
  transfer_limit_years?: number;
  residence_obligation_years?: number;
  rewin_limit_years?: number;
  is_speculative_zone?: boolean;
}

function parseRegulations(text: string): RegulationResult {
  const result: RegulationResult = {};

  // 전매제한
  const tfM = text.match(/전매[^\d]{0,10}?(\d{1,2})\s*년/i) || text.match(/전매제한\s*기간[^\d]{0,10}?(\d{1,2})/i);
  if (tfM) result.transfer_limit_years = parseInt(tfM[1]);

  // 거주의무
  const rsM = text.match(/거주의무[^\d]{0,10}?(\d{1,2})\s*년/i) || text.match(/실거주\s*의무[^\d]{0,10}?(\d{1,2})/i);
  if (rsM) result.residence_obligation_years = parseInt(rsM[1]);

  // 재당첨
  const rwM = text.match(/재당첨[^\d]{0,10}?(\d{1,2})\s*년/i);
  if (rwM) result.rewin_limit_years = parseInt(rwM[1]);

  // 투기과열지구
  if (/투기\s*과열\s*지구/i.test(text)) result.is_speculative_zone = true;

  return result;
}

// ─── 추가 정보 파싱 ───

function parseExtras(text: string): Record<string, unknown> {
  const extras: Record<string, unknown> = {};

  // 발코니 확장비
  const balM = text.match(/발코니\s*확장[^\d]{0,30}?([\d,]+)\s*만/i);
  if (balM) extras.balcony_price = num(balM[1]);

  // 납부일정
  const downM = text.match(/계약금[^\d]{0,10}?(\d{1,3})\s*%/i);
  if (downM) extras.down_payment_pct = parseInt(downM[1]);
  const interimM = text.match(/중도금[^\d]{0,10}?(\d{1,2})\s*회/i);
  if (interimM) extras.interim_count = parseInt(interimM[1]);
  const balanceM = text.match(/잔금[^\d]{0,10}?(\d{1,3})\s*%/i);
  if (balanceM) extras.balance_pct = parseInt(balanceM[1]);

  // 에너지 효율
  const energyM = text.match(/에너지\s*효율\s*등급?\s*[:\s]*(\d|1\+)/i);
  if (energyM) extras.energy_grade = energyM[1] + '등급';
  const zeroM = text.match(/제로\s*에너지[^\d]{0,10}?(\d)\s*등급/i);
  if (zeroM) extras.zero_energy_cert = zeroM[1] + '등급';

  // 설계사
  const archM = text.match(/설계[:\s]*([\w가-힣]+(?:건축|설계)[\w가-힣]*사무소)/i) || text.match(/건축사\s*사무소[:\s]*([\w가-힣]+)/i);
  if (archM) extras.architect = archM[1].trim().slice(0, 50);

  // 조경
  const landM = text.match(/조경[:\s]*([\w가-힣]+(?:조경|설계|디자인)[\w가-힣]*)/i);
  if (landM) extras.landscape_designer = landM[1].trim().slice(0, 50);

  // 커뮤니티
  const commKeywords = ['피트니스', '헬스장', '골프', 'GX', '독서실', '도서관', '사우나', '찜질', '수영장',
    '어린이집', '키즈', '놀이터', '경로당', '카페', '회의실', '스크린골프', '탁구', '실내체육관'];
  const found: { name: string; category: string }[] = [];
  for (const kw of commKeywords) {
    if (text.includes(kw)) {
      const cat = ['피트니스', '헬스장', '수영장', 'GX', '실내체육관'].includes(kw) ? 'fitness'
        : ['골프', '스크린골프', '탁구'].includes(kw) ? 'sports'
        : ['어린이집', '키즈', '놀이터'].includes(kw) ? 'kids'
        : ['경로당'].includes(kw) ? 'senior'
        : 'common';
      found.push({ name: kw, category: cat });
    }
  }
  if (found.length > 0) {
    extras.community_list = found;
    extras.has_fitness = found.some(f => f.category === 'fitness');
    extras.has_daycare = found.some(f => f.name === '어린이집');
  }

  // 천장고
  const ceilM = text.match(/천장고[^\d]{0,10}?([\d.]+)\s*(?:m|미터)/i);
  if (ceilM) extras.ceiling_height = parseFloat(ceilM[1]);

  // 계단식/복도식
  if (/계단식/i.test(text)) extras.entrance_type = '계단식';
  else if (/복도식/i.test(text)) extras.entrance_type = '복도식';
  else if (/혼합식/i.test(text)) extras.entrance_type = '혼합식';

  // 학교
  const schoolPats = [
    /(?:배정|통학)\s*(?:초등)?학교[:\s]*([\w가-힣]+(?:초등?학교|초))/gi,
    /([\w가-힣]+초등?학교)\s*(?:도보|약)?\s*(\d+)\s*(?:분|m)/gi,
  ];
  const schools: { name: string; distance?: string }[] = [];
  for (const sp of schoolPats) {
    let sm;
    while ((sm = sp.exec(text)) !== null) {
      const name = sm[1].trim();
      if (name.length > 2 && name.length < 20 && !schools.some(s => s.name === name)) {
        schools.push({ name, distance: sm[2] ? `도보 ${sm[2]}분` : undefined });
      }
    }
  }
  if (schools.length > 0) extras.schools = schools;

  // 지하철
  const stationPats = [
    /([\w가-힣]+역)\s*(?:도보|약)?\s*(\d+)\s*(?:분|m)/gi,
    /(?:지하철|전철)[^\w가-힣]{0,10}([\w가-힣]+역)/gi,
  ];
  const stations: { name: string; walk_min?: number }[] = [];
  for (const sp of stationPats) {
    let sm;
    while ((sm = sp.exec(text)) !== null) {
      const name = sm[1].trim();
      if (name.length > 2 && name.length < 15 && !stations.some(s => s.name === name)) {
        stations.push({ name, walk_min: sm[2] ? parseInt(sm[2]) : undefined });
      }
    }
  }
  if (stations.length > 0) extras.stations = stations;

  // 특화설계
  const specials: string[] = [];
  if (/테라스/i.test(text)) specials.push('테라스');
  if (/복층/i.test(text)) specials.push('복층');
  if (/팬트리/i.test(text)) specials.push('팬트리');
  if (/알파룸/i.test(text)) specials.push('알파룸');
  if (/드레스룸/i.test(text)) specials.push('드레스룸');
  if (/현관\s*중문/i.test(text)) specials.push('현관중문');
  if (specials.length > 0) extras.special_features = specials.join(', ');

  return extras;
}

// ─── 단일 PDF 처리 ───

async function parsePdfPricing(
  apt: { id: number; house_nm: string; announcement_pdf_url: string; house_type_info: any; tot_supply_hshld_co: number },
  pdfParse: any,
  sb: any
): Promise<{ ok: boolean; fields: number; priceOk: boolean }> {
  try {
    const res = await fetch(apt.announcement_pdf_url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KadeoraBot/1.0)' },
    });
    if (!res.ok) return { ok: false, fields: 0, priceOk: false };

    const buf = Buffer.from(await res.arrayBuffer());
    const pdf = await pdfParse(buf, { max: 12 }); // 12페이지까지 파싱
    const text: string = pdf.text || '';
    if (text.length < 200) return { ok: false, fields: 0, priceOk: false };

    const ud: Record<string, any> = {};
    let f = 0;
    let priceOk = false;

    // 1. 가격 파싱 (타입별)
    const types = Array.isArray(apt.house_type_info) ? apt.house_type_info : [];
    if (types.length > 0) {
      let anyPriceFound = false;
      const updatedTypes = types.map((t: any) => {
        const result = parsePriceTable(text, t.type || '', t.lttot_top_amount || 0);
        if (result) {
          anyPriceFound = true;
          return {
            ...t,
            lttot_min_amount: result.min,
            lttot_avg_amount: result.avg,
            floor_prices: result.floor_prices,
            price_source: result.source,
          };
        }
        return t;
      });

      if (anyPriceFound) {
        ud.house_type_info = updatedTypes;
        // 평균 평당가 재계산 (평균가 기반)
        const priceTypes = updatedTypes.filter((t: any) => {
          const ea = parseFloat((t.type || '0').replace(/[A-Za-z]/g, ''));
          return (t.lttot_avg_amount || t.lttot_top_amount) > 0 && ea > 10;
        });
        if (priceTypes.length > 0) {
          const calcPP = (field: string) => {
            const valid = priceTypes.filter((t: any) => t[field] > 0);
            if (valid.length === 0) return null;
            return Math.round(valid.reduce((s: number, t: any) => {
              const ea = parseFloat((t.type || '0').replace(/[A-Za-z]/g, ''));
              return s + (t[field] / (ea / 3.3058));
            }, 0) / valid.length);
          };
          const ppMin = calcPP('lttot_min_amount');
          const ppAvg = calcPP('lttot_avg_amount');
          const ppMax = calcPP('lttot_top_amount');
          if (ppMin) { ud.price_per_pyeong_min = ppMin; f++; }
          if (ppAvg) { ud.price_per_pyeong_avg = ppAvg; f++; }
          if (ppMax) { ud.price_per_pyeong_max = ppMax; f++; }
        }
        ud.price_source = 'pdf';
        ud.price_parsed_at = new Date().toISOString();
        priceOk = true;
        f++;
      }
    }

    // 2. 규제 파싱
    const regs = parseRegulations(text);
    if (regs.transfer_limit_years) { ud.transfer_limit_years = regs.transfer_limit_years; f++; }
    if (regs.residence_obligation_years) { ud.residence_obligation_years = regs.residence_obligation_years; f++; }
    if (regs.rewin_limit_years) { ud.rewin_limit_years = regs.rewin_limit_years; f++; }
    if (regs.is_speculative_zone) { ud.is_speculative_zone = true; f++; }

    // 3. 추가 정보 파싱
    const extras = parseExtras(text);
    for (const [k, v] of Object.entries(extras)) {
      if (v !== undefined && v !== null) { ud[k] = v; f++; }
    }

    // 4. 취득세 자동 계산
    if (types.length > 0) {
      const mainType = types[0];
      const ea = parseFloat((mainType.type || '0').replace(/[A-Za-z]/g, ''));
      const price = mainType.lttot_avg_amount || mainType.lttot_top_amount || 0;
      if (price > 0 && ea > 0) {
        const taxRate = price <= 60000 ? 0.01 : price <= 90000 ? 0.01 + ((price - 60000) / 30000) * 0.02 : 0.03;
        const tax = Math.round(price * taxRate);
        const edu = Math.round(tax * 0.1);
        const rural = ea > 85 ? Math.round(tax * 0.2) : 0;
        ud.acquisition_tax_est = tax + edu + rural;
        f++;
      }
    }

    // 5. pdf_parse_version 마킹
    ud.pdf_parse_version = 1;

    if (f > 0) {
      await (sb as any).from('apt_subscriptions').update(ud).eq('id', apt.id);
    }

    return { ok: true, fields: f, priceOk };
  } catch {
    return { ok: false, fields: 0, priceOk: false };
  }
}

// ─── 메인 크론 ───

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('apt-parse-pdf-pricing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const sb = getSupabaseAdmin();

    const BATCH_SIZE = 200;
    const CONCURRENCY = 10;
    const START_TIME = Date.now();
    const MAX_RUNTIME_MS = 250000; // 250초 (300초 제한에서 50초 여유)

    // pdf_parse_version이 0 또는 null인 레코드 (미파싱)
    const { data: targets } = await (sb as any).from('apt_subscriptions')
      .select('id, house_nm, announcement_pdf_url, house_type_info, tot_supply_hshld_co')
      .not('announcement_pdf_url', 'is', null).neq('announcement_pdf_url', '')
      .or('pdf_parse_version.is.null,pdf_parse_version.eq.0')
      .order('id', { ascending: false })
      .limit(BATCH_SIZE);

    if (!targets?.length) {
      return { processed: 0, failed: 0, priceFound: 0, fieldsTotal: 0, remaining: 0, metadata: { message: 'PDF 가격 파싱 완료!' } };
    }

    const { count: remaining } = await (sb as any).from('apt_subscriptions')
      .select('id', { count: 'exact', head: true })
      .not('announcement_pdf_url', 'is', null).neq('announcement_pdf_url', '')
      .or('pdf_parse_version.is.null,pdf_parse_version.eq.0');

    let processed = 0, failed = 0, priceFound = 0, fieldsTotal = 0;

    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      // 시간 초과 안전장치 — 250초 넘으면 중단
      if (Date.now() - START_TIME > MAX_RUNTIME_MS) break;

      const chunk = targets.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((apt: any) => parsePdfPricing(apt, pdfParse, sb).catch(() => ({ ok: false, fields: 0, priceOk: false })))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value.ok) { processed++; fieldsTotal += r.value.fields; }
          else { failed++; }
          if (r.value.priceOk) priceFound++;
        } else { failed++; }
      }
    }

    return {
      processed, failed, priceFound, fieldsTotal,
      batch: targets.length,
      remaining: Math.max((remaining || 0) - targets.length, 0),
    };
  });

  return NextResponse.json(result);
});

export async function POST(req: NextRequest) { return GET(req); }
