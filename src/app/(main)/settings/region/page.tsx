'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';

const REGIONS: Record<string, string[]> = {
  '서울': ['강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'],
  '부산': ['강서구','금정구','기장군','남구','동구','동래구','부산진구','북구','사상구','사하구','서구','수영구','연제구','영도구','중구','해운대구'],
  '대구': ['남구','달서구','달성군','동구','북구','서구','수성구','중구'],
  '인천': ['강화군','계양구','남동구','동구','미추홀구','부평구','서구','연수구','옹진군','중구'],
  '광주': ['광산구','남구','동구','북구','서구'],
  '대전': ['대덕구','동구','서구','유성구','중구'],
  '울산': ['남구','동구','북구','울주군','중구'],
  '세종': ['세종시'],
  '경기': ['가평군','고양시','과천시','광명시','광주시','구리시','군포시','김포시','남양주시','동두천시','부천시','성남시','수원시','시흥시','안산시','안성시','안양시','양주시','양평군','여주시','연천군','오산시','용인시','의왕시','의정부시','이천시','파주시','평택시','포천시','하남시','화성시'],
  '강원': ['강릉시','고성군','동해시','삼척시','속초시','양구군','양양군','영월군','원주시','인제군','정선군','철원군','춘천시','태백시','평창군','홍천군','화천군','횡성군'],
  '충북': ['괴산군','단양군','보은군','영동군','옥천군','음성군','제천시','증평군','진천군','청주시','충주시'],
  '충남': ['계룡시','공주시','금산군','논산시','당진시','보령시','부여군','서산시','서천군','아산시','예산군','천안시','청양군','태안군','홍성군'],
  '전북': ['고창군','군산시','김제시','남원시','무주군','부안군','순창군','완주군','익산시','임실군','장수군','전주시','정읍시','진안군'],
  '전남': ['강진군','고흥군','곡성군','광양시','구례군','나주시','담양군','목포시','무안군','보성군','순천시','신안군','여수시','영광군','영암군','완도군','장성군','장흥군','진도군','함평군','해남군','화순군'],
  '경북': ['경산시','경주시','고령군','구미시','군위군','김천시','문경시','봉화군','상주시','성주군','안동시','영덕군','영양군','영주시','영천시','예천군','울릉군','울진군','의성군','청도군','청송군','칠곡군','포항시'],
  '경남': ['거제시','거창군','고성군','김해시','남해군','밀양시','사천시','산청군','양산시','의령군','진주시','창녕군','창원시','통영시','하동군','함안군','함양군','합천군'],
  '제주': ['제주시','서귀포시'],
};

export default function RegionSettingsPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const { success, error: showError } = useToast();
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [currentRegion, setCurrentRegion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    sb.from('profiles').select('residence_city,residence_district,region_text').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (data?.residence_city) setCity(data.residence_city);
        if (data?.residence_district) setDistrict(data.residence_district);
        if (data?.region_text) setCurrentRegion(data.region_text);
      });
  }, [userId]);

  const handleSave = async () => {
    if (!city || !district || !userId) return;
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      const regionText = `${city} ${district}`;
      await sb.from('profiles').update({
        residence_city: city,
        residence_district: district,
        region_text: regionText,
        region_id: city,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
      setCurrentRegion(regionText);
      // 데일리 리포트 자동 연동
      if (typeof window !== 'undefined') {
        localStorage.setItem('daily_region', city);
      }
      success('지역 설정 완료!');
    } catch {
      showError('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📍</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>로그인이 필요합니다</div>
        <a href="/login?redirect=/settings/region" style={{ color: 'var(--brand)', fontWeight: 600 }}>로그인하기</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, marginBottom: 16, padding: 0 }}>
        ← 뒤로
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>📍 우리동네 설정</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        같은 동네 이웃들과 부동산·생활 정보를 나눌 수 있어요
      </p>

      {currentRegion && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-card)',
          background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.15)',
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>📍</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>현재 설정: {currentRegion}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>아래에서 변경할 수 있어요</div>
          </div>
        </div>
      )}

      {/* 시/도 선택 */}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>시/도</label>
      <select value={city} onChange={e => { setCity(e.target.value); setDistrict(''); }} style={{
        width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontSize: 14, outline: 'none', marginBottom: 16,
        appearance: 'none',
      }}>
        <option value="">선택하세요</option>
        {Object.keys(REGIONS).map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* 구/군 선택 */}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>구/군</label>
      <select value={district} onChange={e => setDistrict(e.target.value)} disabled={!city} style={{
        width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        color: city ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 14, outline: 'none', marginBottom: 24,
        opacity: city ? 1 : 0.5, appearance: 'none',
      }}>
        <option value="">{city ? '선택하세요' : '시/도를 먼저 선택하세요'}</option>
        {city && REGIONS[city]?.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      <button onClick={handleSave} disabled={!city || !district || saving} style={{
        width: '100%', padding: '14px 0', borderRadius: 'var(--radius-md)',
        background: city && district ? 'var(--brand)' : 'var(--bg-hover)',
        color: city && district ? '#fff' : 'var(--text-tertiary)',
        border: 'none', fontSize: 15, fontWeight: 700, cursor: city && district ? 'pointer' : 'default',
        opacity: saving ? 0.6 : 1,
      }}>
        {saving ? '저장 중...' : '설정하기'}
      </button>

      <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        💡 우리동네 기능은 피드에서 "우리동네" 탭을 통해 같은 지역 이웃들의 글만 모아볼 수 있어요. 지역 정보는 언제든 변경할 수 있습니다.
      </div>
    </div>
  );
}
