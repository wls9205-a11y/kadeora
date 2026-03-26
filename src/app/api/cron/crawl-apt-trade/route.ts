import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 300; // 5분 (전국 200개 시군구 × 올해 전체 월)

const LAWD_CODES: Record<string, string> = {
  '서울 종로구':'11110','서울 중구':'11140','서울 용산구':'11170','서울 성동구':'11200',
  '서울 광진구':'11215','서울 동대문구':'11230','서울 중랑구':'11260','서울 성북구':'11290',
  '서울 강북구':'11305','서울 도봉구':'11320','서울 노원구':'11350','서울 은평구':'11380',
  '서울 서대문구':'11410','서울 마포구':'11440','서울 양천구':'11470','서울 강서구':'11500',
  '서울 구로구':'11530','서울 금천구':'11545','서울 영등포구':'11560','서울 동작구':'11590',
  '서울 관악구':'11620','서울 서초구':'11650','서울 강남구':'11680','서울 송파구':'11710',
  '서울 강동구':'11740',
  '경기 수원시':'41111','경기 성남시':'41131','경기 고양시':'41281','경기 용인시':'41461',
  '경기 부천시':'41190','경기 안양시':'41171','경기 화성시':'41590','경기 평택시':'41220',
  '경기 시흥시':'41390','경기 김포시':'41570','경기 광명시':'41210','경기 군포시':'41410',
  '경기 하남시':'41450','경기 오산시':'41370','경기 이천시':'41500','경기 안성시':'41550',
  '경기 의왕시':'41430','경기 양주시':'41630','경기 여주시':'41670','경기 구리시':'41310',
  '경기 남양주시':'41360','경기 파주시':'41480','경기 의정부시':'41150','경기 동두천시':'41250',
  '경기 광주시':'41610','경기 포천시':'41650','경기 양평군':'41830','경기 가평군':'41820',
  '경기 연천군':'41800','경기 과천시':'41290','경기 수원영통':'41115',
  '부산 중구':'26110','부산 서구':'26140','부산 동구':'26170','부산 영도구':'26200',
  '부산 부산진구':'26230','부산 동래구':'26260','부산 남구':'26290','부산 북구':'26320',
  '부산 해운대구':'26350','부산 사하구':'26380','부산 금정구':'26410','부산 강서구':'26440',
  '부산 연제구':'26470','부산 수영구':'26500','부산 사상구':'26530','부산 기장군':'26710',
  // 대구 (8개)
  '대구 중구':'27110','대구 동구':'27140','대구 서구':'27170','대구 남구':'27200',
  '대구 북구':'27230','대구 수성구':'27260','대구 달서구':'27290','대구 달성군':'27710',
  // 인천 (10개)
  '인천 중구':'28110','인천 동구':'28140','인천 미추홀구':'28177','인천 연수구':'28185',
  '인천 남동구':'28200','인천 부평구':'28237','인천 계양구':'28245','인천 서구':'28260',
  '인천 강화군':'28710','인천 옹진군':'28720',
  // 광주 (5개)
  '광주 동구':'29110','광주 서구':'29140','광주 남구':'29155','광주 북구':'29170',
  '광주 광산구':'29200',
  // 대전 (5개)
  '대전 동구':'30110','대전 중구':'30140','대전 서구':'30170','대전 유성구':'30200',
  '대전 대덕구':'30230',
  // 울산 (5개)
  '울산 중구':'31110','울산 남구':'31140','울산 동구':'31170','울산 북구':'31200',
  '울산 울주군':'31710',
  // 세종 (1개)
  '세종시':'36110',
  // 강원 (18개)
  '강원 춘천시':'42110','강원 원주시':'42130','강원 강릉시':'42150','강원 동해시':'42170',
  '강원 태백시':'42190','강원 속초시':'42210','강원 삼척시':'42230','강원 홍천군':'42720',
  '강원 횡성군':'42730','강원 영월군':'42750','강원 평창군':'42760','강원 정선군':'42770',
  '강원 철원군':'42780','강원 화천군':'42790','강원 양구군':'42800','강원 인제군':'42810',
  '강원 고성군':'42820','강원 양양군':'42830',
  // 충북 (12개)
  '충북 청주시':'43111','충북 충주시':'43130','충북 제천시':'43150',
  '충북 보은군':'43720','충북 옥천군':'43730','충북 영동군':'43740',
  '충북 증평군':'43745','충북 진천군':'43750','충북 괴산군':'43760',
  '충북 음성군':'43770','충북 단양군':'43800','충북 청원구':'43112',
  // 충남 (16개)
  '충남 천안시':'44131','충남 공주시':'44150','충남 보령시':'44180',
  '충남 아산시':'44200','충남 서산시':'44210','충남 논산시':'44230',
  '충남 계룡시':'44250','충남 당진시':'44270','충남 금산군':'44710',
  '충남 부여군':'44760','충남 서천군':'44770','충남 청양군':'44790',
  '충남 홍성군':'44800','충남 예산군':'44810','충남 태안군':'44825',
  '충남 연기군':'44830',
  // 전북 (14개)
  '전북 전주시':'45111','전북 군산시':'45130','전북 익산시':'45140',
  '전북 정읍시':'45180','전북 남원시':'45190','전북 김제시':'45210',
  '전북 완주군':'45710','전북 진안군':'45720','전북 무주군':'45730',
  '전북 장수군':'45740','전북 임실군':'45750','전북 순창군':'45770',
  '전북 고창군':'45790','전북 부안군':'45800',
  // 전남 (22개)
  '전남 목포시':'46110','전남 여수시':'46130','전남 순천시':'46150',
  '전남 나주시':'46170','전남 광양시':'46230','전남 담양군':'46710',
  '전남 곡성군':'46720','전남 구례군':'46730','전남 고흥군':'46770',
  '전남 보성군':'46780','전남 화순군':'46790','전남 장흥군':'46800',
  '전남 강진군':'46810','전남 해남군':'46820','전남 영암군':'46830',
  '전남 무안군':'46840','전남 함평군':'46860','전남 영광군':'46870',
  '전남 장성군':'46880','전남 완도군':'46890','전남 진도군':'46900',
  '전남 신안군':'46910',
  // 경북 (23개)
  '경북 포항시':'47111','경북 경주시':'47130','경북 김천시':'47150',
  '경북 안동시':'47170','경북 구미시':'47190','경북 영주시':'47210',
  '경북 영천시':'47230','경북 상주시':'47250','경북 문경시':'47280',
  '경북 경산시':'47290','경북 군위군':'47720','경북 의성군':'47730',
  '경북 청송군':'47750','경북 영양군':'47760','경북 영덕군':'47770',
  '경북 청도군':'47820','경북 고령군':'47830','경북 성주군':'47840',
  '경북 칠곡군':'47850','경북 예천군':'47900','경북 봉화군':'47920',
  '경북 울진군':'47930','경북 울릉군':'47940',
  // 경남 (18개)
  '경남 창원시':'48121','경남 진주시':'48170','경남 통영시':'48220',
  '경남 사천시':'48240','경남 김해시':'48250','경남 밀양시':'48270',
  '경남 거제시':'48310','경남 양산시':'48330','경남 의령군':'48720',
  '경남 함안군':'48730','경남 창녕군':'48740','경남 고성군':'48820',
  '경남 남해군':'48840','경남 하동군':'48850','경남 산청군':'48860',
  '경남 함양군':'48870','경남 거창군':'48880','경남 합천군':'48890',
  // 제주 (2개)
  '제주 제주시':'50110','제주 서귀포시':'50130',
};

function parseXmlItems(xml: string): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const b = m[1];
    const g = (tag: string) => { const r = b.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)); return r ? r[1].trim() : null; };
    items.push({
      apt_name: g('아파트') || g('aptNm') || '미상',
      dong: g('법정동') || g('umdNm') || null,
      exclusive_area: parseFloat(g('전용면적') || g('excluUseAr') || '0'),
      deal_amount: parseInt((g('거래금액') || g('dealAmount') || '0').replace(/,/g, '').trim()),
      deal_year: g('년') || g('dealYear'), deal_month: g('월') || g('dealMonth'), deal_day: g('일') || g('dealDay'),
      floor: parseInt(g('층') || g('floor') || '0'),
      built_year: parseInt(g('건축년도') || g('buildYear') || '0'),
    });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const apiKey = process.env.BUSAN_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'BUSAN_DATA_API_KEY not set' }, { status: 200 });

  const supabase = getSupabaseAdmin();

  const result = await withCronLogging('crawl-apt-trade', async () => {
    const now = new Date();
    // 올해 1월부터 현재 월까지 전부 수집
    const months: string[] = [];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    for (let m = 1; m <= currentMonth; m++) {
      months.push(`${currentYear}${String(m).padStart(2, '0')}`);
    }

    const entries = Object.entries(LAWD_CODES);
    let totalInserted = 0;
    const failed: string[] = [];
    const BATCH = 15;

    async function fetchOne(label: string, lawdCd: string): Promise<number> {
      const [regionPart, sigunguPart] = label.split(' ');
      let count = 0;
      for (const ym of months) {
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${encodeURIComponent(apiKey!)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=1000`;
        const res = await fetch(url);
        const xml = await res.text();
        const items = parseXmlItems(xml);
        const rows = items.map(it => ({
          apt_name: it.apt_name, region_nm: regionPart, sigungu: sigunguPart, dong: it.dong,
          exclusive_area: it.exclusive_area, deal_amount: it.deal_amount,
          deal_date: it.deal_year && it.deal_month && it.deal_day
            ? `${it.deal_year}-${String(it.deal_month).padStart(2,'0')}-${String(it.deal_day).padStart(2,'0')}` : null,
          floor: it.floor, built_year: it.built_year || null, trade_type: '매매', source: 'molit_trade',
        })).filter(r => r.deal_amount > 0 && r.deal_date);
        if (rows.length > 0) {
          const { error } = await supabase.from('apt_transactions').insert(rows);
          if (!error) count += rows.length;
        }
      }
      return count;
    }

    // 5 그룹 × 15개 병렬
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(([name, code]) => fetchOne(name, code)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') totalInserted += r.value;
        else failed.push(batch[j][0]);
      }
    }

    // 관심단지 알림 생성
    let notifCount = 0;
    try {
      const { data: watchItems } = await supabase.from('apt_watchlist').select('user_id, item_id').eq('item_type', 'transaction').eq('notify_enabled', true);
      if (watchItems?.length) {
        const aptNames = new Set(watchItems.map(w => w.item_id));
        const { data: newTrades } = await supabase.from('apt_transactions')
          .select('apt_name, deal_amount, deal_date')
          .in('apt_name', Array.from(aptNames))
          .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .limit(50);
        if (newTrades?.length) {
          const notifs = watchItems.filter(w => newTrades.some((t: Record<string, any>) => t.apt_name === w.item_id))
            .map(w => {
              const trade = newTrades.find((t: Record<string, any>) => t.apt_name === w.item_id);
              return { user_id: w.user_id, type: 'system', content: `관심단지 ${w.item_id}의 새 거래가 등록되었습니다. ${trade?.deal_date} ${trade?.deal_amount ? (trade.deal_amount / 10000).toFixed(1) + '억' : ''}` };
            });
          if (notifs.length > 0) {
            await supabase.from('notifications').insert(notifs);
            notifCount = notifs.length;
          }
        }
      }
    } catch {}

    return {
      processed: entries.length,
      created: totalInserted,
      failed: failed.length,
      metadata: { api_name: 'data_go_kr', api_calls: entries.length * 2, months, notifications: notifCount, ...(failed.length > 0 ? { failed } : {}) },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
