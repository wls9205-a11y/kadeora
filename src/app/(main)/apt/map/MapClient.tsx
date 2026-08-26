'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { SkeletonChart } from '@/components/Skeleton';

type Layer = 'subscription' | 'ongoing' | 'redevelopment' | 'unsold';
const LAYER_CONF: Record<Layer, { label: string; icon: string; color: string }> = {
  subscription: { label: '청약', icon: '📋', color: 'var(--brand)' },
  ongoing: { label: '분양중', icon: '🏗️', color: 'var(--accent-green)' },
  redevelopment: { label: '재개발', icon: '🔨', color: 'var(--accent-orange)' },
  unsold: { label: '미분양', icon: '🏚️', color: 'var(--accent-red)' },
};

/**
 * 화면에 «켤 수 있는» 레이어. LAYER_CONF 에서 재개발을 지우지 않은 이유는
 * 좌표가 채워지면 여기 한 줄만 되돌리면 되게 하려는 것이다. 데이터도 그대로 둔다.
 *
 * ── 재개발을 내린 근거 (2026-08-26 실측) ──
 *
 * 이 레이어는 `redevelopment_projects` 를 읽는다 (`apt_sites` 가 아니다).
 *   · 부울경 381곳 중 좌표 보유 **61곳 = 16.0%** (부산 363/53 · 경남 10/4 · 울산 8/4)
 *   · 서울은 793곳 중 10곳 = 1.3%
 *   · 부산 좌표 53곳 중 **18곳(34%)** 의 address 가 `…로 32 4층` 꼴 — 조합 사무실이다
 *
 * ⚠️ **더 나쁜 건 좌표가 «없는» 쪽이다.** 아래 pins.forEach 는 좌표가 없으면
 *    `geocoder.addressSearch(pin.address)` 로 브라우저에서 지오코딩한다.
 *    정비사업의 address 는 상당수가 조합 사무실 주소라, 지오코딩이 «성공해서»
 *    사업장이 아닌 사무실을 사업장인 것처럼 찍는다. 실패보다 나쁘다 —
 *    지도는 정확해 보이는 만큼 더 위험하다.
 *
 * ⚠️ 동 중심 폴백도 섞여 있다. `apt_sites` 쪽 실측이지만 같은 지오코더가 만든 값이다:
 *    대연2·3·4·5·6·8 재개발이 «한 점»에 겹쳐 있었다(주소는 서로 다른 조합 사무실).
 *    그 판정은 이제 `apt_sites.coord_confidence`('exact'|'approx')에 들어 있다 —
 *    부울경 approx 82곳 중 정비사업이 84곳 중 대부분이고, 큐레이션 현장은 0곳이다.
 *
 * → 재개발은 지도가 아니라 `/apt/redev` 허브의 목록·단계로 보여준다.
 *    좌표가 97.3% 있는 청약·분양중·미분양만 지도에 남긴다.
 *
 * 되살리는 조건: `redevelopment_projects` 의 부울경 좌표 보유율이 의미 있게 오르고,
 * 그 좌표가 조합 사무실이 아니라 사업장인 것이 확인될 때. 그 전에는 켜지 않는다.
 */
const AVAILABLE_LAYERS: Layer[] = ['subscription', 'ongoing', 'unsold'];

interface Pin { id: number | string; name: string; address: string; layer: Layer; lat?: number; lng?: number; extra?: string; }

declare global {
  interface Window { kakao: any; }
}

export default function MapClient() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<any>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [layers, setLayers] = useState<Set<Layer>>(new Set(AVAILABLE_LAYERS));
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowser();
    const allPins: Pin[] = [];

    try {
      if (layers.has('subscription')) {
        const { data } = await sb.from('apt_subscriptions')
          .select('id, house_nm, hssply_adres, region_nm, tot_supply_hshld_co, rcept_endde')
          .order('rcept_endde', { ascending: false }).limit(300) as { data: Record<string, any>[] | null };
        (data || []).forEach((d: Record<string, any>) => allPins.push({
          id: d.id, name: d.house_nm, address: d.hssply_adres || d.region_nm || '',
          layer: 'subscription', extra: `${d.tot_supply_hshld_co || '?'}세대 · ~${(d.rcept_endde || '').slice(5)}`,
        }));
      }

      if (layers.has('ongoing')) {
        const { data } = await sb.from('apt_subscriptions')
          .select('id, house_nm, hssply_adres, region_nm, tot_supply_hshld_co, mvn_prearnge_ym, rcept_endde')
          .lt('rcept_endde', new Date().toISOString().slice(0, 10))
          .order('rcept_endde', { ascending: false }).limit(300) as { data: Record<string, any>[] | null };
        const seen = new Set(allPins.map(p => p.name));
        (data || []).filter((d: Record<string, any>) => !seen.has(d.house_nm)).forEach((d: Record<string, any>) => allPins.push({
          id: `o${d.id}`, name: d.house_nm, address: d.hssply_adres || d.region_nm || '',
          layer: 'ongoing', extra: `${d.tot_supply_hshld_co || '?'}세대${d.mvn_prearnge_ym ? ` · 입주 ${d.mvn_prearnge_ym.slice(0,4)}.${parseInt(d.mvn_prearnge_ym.slice(4))}` : ''}`,
        }));
      }

      /* ⚠️ 지금은 «닿지 않는 분기»다 — AVAILABLE_LAYERS 에 'redevelopment' 가 없어
       *    layers 에 절대 들어오지 않는다. 지우지 않고 남겨 둔 이유는 위 주석의
       *    되살리는 조건이 충족되면 AVAILABLE_LAYERS 한 줄로 복구하기 위해서다. */
      if (layers.has('redevelopment')) {
        const { data } = await sb.from('redevelopment_projects')
          .select('id, district_name, address, region, stage, total_households, latitude, longitude')
          .eq('is_active', true).limit(300) as { data: Record<string, any>[] | null };
        (data || []).forEach((d: Record<string, any>) => allPins.push({
          id: `r${d.id}`, name: d.district_name || d.address || '', address: d.address || d.region || '',
          layer: 'redevelopment', extra: d.stage || '진행중',
          lat: d.latitude ? parseFloat(d.latitude) : undefined,
          lng: d.longitude ? parseFloat(d.longitude) : undefined,
        }));
      }

      if (layers.has('unsold')) {
        const { data } = await sb.from('unsold_apts')
          .select('id, house_nm, region_nm, tot_unsold_hshld_co, latitude, longitude')
          .eq('is_active', true).limit(300) as { data: Record<string, any>[] | null };
        (data || []).forEach((d: Record<string, any>) => allPins.push({
          id: `u${d.id}`, name: d.house_nm || '', address: d.region_nm || '',
          layer: 'unsold', extra: `${d.tot_unsold_hshld_co || 0}세대 미분양`,
          lat: d.latitude ? parseFloat(d.latitude) : undefined,
          lng: d.longitude ? parseFloat(d.longitude) : undefined,
        }));
      }
    } catch { }

    setPins(allPins);
    setLoading(false);
  }, [layers]);

  useEffect(() => { loadData(); }, [loadData]);

  // 카카오맵 초기화
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;
    try {
      const { kakao } = window;
      if (!kakao?.maps) return;

      kakao.maps.load(() => {
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(36.5, 127.5),
          level: 12,
        });
        mapInstance.current = map;

        const zoomControl = new kakao.maps.ZoomControl();
        map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
      });
    } catch { }
  }, [sdkReady]);

  // 핀 표시 — MarkerClusterer로 클러스터링
  useEffect(() => {
    if (!mapInstance.current || !window.kakao?.maps?.services) return;

    // 기존 마커/클러스터 제거
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clear();
      clustererRef.current = null;
    }

    const geocoder = new window.kakao.maps.services.Geocoder();
    const newMarkers: Record<string, any>[] = [];
    let processed = 0;
    const total = pins.length;

    // 클러스터러 생성 (라이브러리 로드 확인)
    const hasClusterer = !!window.kakao.maps.MarkerClusterer;

    const addMarker = (pin: Pin, lat: number, lng: number) => {
      const coords = new window.kakao.maps.LatLng(lat, lng);
      const conf = LAYER_CONF[pin.layer];
      const marker = new window.kakao.maps.Marker({ position: coords, title: pin.name });
      const infoContent = `<div style="padding:6px 10px;font-size:12px;font-weight:600;white-space:nowrap;background:#1e293b;color:#fff;border-radius:6px;border:1px solid ${conf.color}">${conf.icon} ${pin.name}</div>`;
      const infowindow = new window.kakao.maps.InfoWindow({ content: infoContent });
      window.kakao.maps.event.addListener(marker, 'click', () => { setSelectedPin(pin); infowindow.open(mapInstance.current, marker); });
      window.kakao.maps.event.addListener(marker, 'mouseover', () => { infowindow.open(mapInstance.current, marker); });
      window.kakao.maps.event.addListener(marker, 'mouseout', () => { infowindow.close(); });
      newMarkers.push(marker);
    };

    const tryFinalize = () => {
      processed++;
      if (processed >= total && hasClusterer && newMarkers.length > 0) {
        clustererRef.current = new window.kakao.maps.MarkerClusterer({
          map: mapInstance.current, averageCenter: true, minLevel: 5, disableClickZoom: false,
          styles: [{
            width: '44px', height: '44px', background: 'rgba(37,99,235,0.85)',
            borderRadius: '50%', color: '#fff', textAlign: 'center',
            lineHeight: '44px', fontSize: '13px', fontWeight: '800',
          }, {
            width: '54px', height: '54px', background: 'rgba(37,99,235,0.9)',
            borderRadius: '50%', color: '#fff', textAlign: 'center',
            lineHeight: '54px', fontSize: '14px', fontWeight: '800',
          }],
          });
          clustererRef.current.addMarkers(newMarkers);
        } else if (!hasClusterer && newMarkers.length > 0) {
          newMarkers.forEach(m => m.setMap(mapInstance.current));
        }
    };

    pins.forEach(pin => {
      // 좌표가 이미 있으면 바로 사용 (Geocoding 스킵)
      if (pin.lat && pin.lng) {
        addMarker(pin, pin.lat, pin.lng);
        tryFinalize();
        return;
      }
      /* 좌표 없으면 주소로 Geocoding.
       * ⚠️ 이 폴백은 «주소가 사업장을 가리킬 때만» 안전하다. 청약·분양중·미분양은
       *    address 가 공급위치라 괜찮다. 정비사업은 조합 사무실 주소가 섞여 있어
       *    지오코딩이 성공해도 엉뚱한 곳을 찍는다 — 그래서 그 레이어를 내렸다(위 주석).
       *    새 레이어를 여기에 태우기 전에 «그 테이블의 address 가 무엇인지» 먼저 볼 것. */
      if (!pin.address) { tryFinalize(); return; }
      geocoder.addressSearch(pin.address, (result: Record<string, any>[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK && result.length) {
          addMarker(pin, result[0].y, result[0].x);
        }
        tryFinalize();
      });
    });

    markersRef.current = newMarkers;
  }, [pins]);

  const toggleLayer = (layer: Layer) => {
    setLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const [sdkError, setSdkError] = useState(!kakaoKey);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 12px' }}>
      {kakaoKey && <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services,clusterer&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setSdkError(true)}
      />}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
        <div>
          <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 부동산</Link>
          <h1 style={{ margin: '4px 0 0', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>🗺️ 부동산 지도</h1>
        </div>
      </div>

      {/* 레이어 토글 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {/* ⚠️ LAYER_CONF 를 그대로 돌리지 않는다 — 그러면 내린 레이어가 토글로 되살아난다.
            켤 수 있는 목록은 AVAILABLE_LAYERS 하나가 정한다. */}
        {AVAILABLE_LAYERS.map(l => {
          const conf = LAYER_CONF[l];
          const active = layers.has(l);
          return (
            <button aria-label="닫기" key={l} onClick={() => toggleLayer(l)} style={{
              padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600,
              border: `1.5px solid ${active ? conf.color : 'var(--border)'}`,
              background: active ? `${conf.color}15` : 'var(--bg-surface)',
              color: active ? conf.color : 'var(--text-tertiary)',
              cursor: 'pointer', flexShrink: 0,
            }}>
              {conf.icon} {conf.label} ({pins.filter(p => p.layer === l).length})
            </button>
          );
        })}
      </div>

      {/* 지도 */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div ref={mapRef} style={{ width: '100%', height: sdkError ? 'auto' : 'min(500px, 60vh)', background: 'var(--bg-hover)' }}>
          {sdkError ? (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 10 }}>카카오 지도 SDK를 불러올 수 없습니다 · 아래 목록에서 지역별 현황을 확인하세요</div>
              <div style={{ display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'center' }}>
                <a href="https://map.kakao.com" target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(254,229,0,0.1)', border: '1px solid rgba(254,229,0,0.3)', color: '#FEE500', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>카카오맵에서 보기</a>
                <button onClick={() => window.location.reload()} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>새로고침</button>
              </div>
            </div>
          ) : !sdkReady ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 13 }}>
              지도 로딩 중...
            </div>
          ) : null}
        </div>

        {/* 선택된 핀 정보 */}
        {selectedPin && (
          <div style={{
            position: 'absolute', bottom: 16, left: 16, right: 16,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', padding: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-xs)' }}>
                  <span style={{
                    fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                    background: `${LAYER_CONF[selectedPin.layer].color}20`,
                    color: LAYER_CONF[selectedPin.layer].color,
                  }}>
                    {LAYER_CONF[selectedPin.layer].icon} {LAYER_CONF[selectedPin.layer].label}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedPin.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedPin.address}</div>
                {selectedPin.extra && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-xs)' }}>{selectedPin.extra}</div>}
              </div>
              <button onClick={() => setSelectedPin(null)} style={{
                background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-md)',
              }}>✕</button>
            </div>
          </div>
        )}
      </div>

      {/* 핀 리스트 (지도 아래) */}
      {loading ? <SkeletonChart /> : (
        <div style={{ marginTop: 'var(--sp-md)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>총 {pins.length}건</div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {pins.slice(0, 30).map(pin => (
              <div key={pin.id} onClick={() => setSelectedPin(pin)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
              }}>
                <span style={{ fontSize: 16 }}>{LAYER_CONF[pin.layer].icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{pin.address}</div>
                </div>
                {pin.extra && <span style={{ fontSize: 'var(--fs-xs)', color: LAYER_CONF[pin.layer].color, fontWeight: 600, flexShrink: 0 }}>{pin.extra}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
