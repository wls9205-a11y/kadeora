import { errMsg } from '@/lib/error-utils';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SIDO: Record<string, string> = {
  '11': '서울', '26': '부산', '27': '대구', '28': '인천', '29': '광주',
  '30': '대전', '31': '울산', '36': '세종', '41': '경기', '42': '강원',
  '43': '충북', '44': '충남', '45': '전북', '46': '전남', '47': '경북', '48': '경남', '50': '제주',
};

export async function POST() {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const apiKey = process.env.UNSOLD_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'UNSOLD_API_KEY 미설정' }, { status: 503 });

    const supabase = getSupabaseAdmin();

    // 국토부 미분양 통계 API 호출
    const baseUrl = 'https://apis.data.go.kr/1613000/KMHW_UNSOLD_HOUSE_INFO/getUnsoldHouseInfoList';
    const allItems: any[] = [];

    for (const [code, name] of Object.entries(SIDO)) {
      try {
        const url = `${baseUrl}?serviceKey=${apiKey}&numOfRows=100&pageNo=1&sidoCode=${code}&type=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const json = await res.json();

        const items = json?.response?.body?.items?.item;
        if (!items) continue;
        const arr = Array.isArray(items) ? items : [items];

        for (const item of arr) {
          allItems.push({
            region_nm: name,
            sigungu_nm: item.signguNm || item.sigunguNm || '',
            house_nm: item.houseNm || item.brtcNm || `${name} ${item.signguNm || ''}`,
            tot_unsold_hshld_co: parseInt(item.unsoldHshlCo || item.totUnsoldCo || '0') || 0,
            tot_supply_hshld_co: parseInt(item.totSuplyCo || item.totSuplyHshldCo || '0') || 0,
            is_active: true,
          });
        }
      } catch {
        // 개별 시도 실패 시 건너뜀
      }
    }

    if (allItems.length === 0) {
      // API 응답 없으면 대체: 시도별 미분양 현황 통계 API 시도
      try {
        const altUrl = `https://apis.data.go.kr/1613000/pubStorgeOpenApiService/getMolitStatList?serviceKey=${apiKey}&numOfRows=100&pageNo=1&statCode=UNSOLD&type=json`;
        const res = await fetch(altUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const json = await res.json();
          const items = json?.response?.body?.items?.item;
          if (items) {
            const arr = Array.isArray(items) ? items : [items];
            for (const item of arr) {
              const sidoName = SIDO[item.sidoCode] || item.sidoNm || '기타';
              allItems.push({
                region_nm: sidoName,
                sigungu_nm: item.signguNm || '',
                house_nm: item.houseNm || `${sidoName} 미분양`,
                tot_unsold_hshld_co: parseInt(item.unsoldCo || item.value || '0') || 0,
                tot_supply_hshld_co: 0,
                is_active: true,
              });
            }
          }
        }
      } catch {}
    }

    if (allItems.length === 0) {
      return NextResponse.json({ success: false, count: 0, message: 'API에서 데이터를 받지 못했습니다. API 키 또는 엔드포인트를 확인하세요.' });
    }

    // 기존 데이터 비활성화
    await supabase.from('unsold_apts').update({ is_active: false }).eq('is_active', true);

    // 새 데이터 삽입
    const { error } = await supabase.from('unsold_apts').insert(allItems);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, count: allItems.length, message: `${allItems.length}개 현장 업데이트 완료` });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) || '서버 오류' }, { status: 500 });
  }
}
