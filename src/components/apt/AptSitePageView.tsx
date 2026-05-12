// components/apt/AptSitePageView.tsx
import Image from 'next/image';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import type { AptSitePageData } from '@/lib/apt-subscription-meta';
import {
  formatKoreanPrice,
  formatPyeongPrice,
  formatDate,
  formatYearMonth,
  formatRelativeTime,
  formatMargin,
} from '@/lib/apt-format';
import { DDayCountdown } from './DDayCountdown';
import { PrimaryCTABar } from './PrimaryCTABar';
import { StickyBottomBar } from './StickyBottomBar';
import { FloorPlanGallery } from './FloorPlanGallery';
import { FAQAccordion } from './FAQAccordion';
import { LockedSection } from './LockedSection';

export async function AptSitePageView({ data }: { data: AptSitePageData }) {
  const { site, subscription: sub } = data;

  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const isAuthed = !!user;

  const houseTypes = ((sub?.house_type_info as any[]) || []).filter(Boolean);
  const supplyBreakdown = (sub?.supply_breakdown as any[]) || [];
  const paymentSchedule = sub?.payment_schedule as any;
  const nearbyFacilities = (site as any).nearby_facilities as any;
  const keyFeatures = (site as any).key_features as string[] | undefined;
  const faqs = site.faqs || site.faq_items || [];
  const analysisText = (site as any).analysis_text as string | undefined;

  return (
    <article className="min-h-screen bg-white dark:bg-slate-950 pb-24 sm:pb-8">
      <header className="relative">
        {site.cover_image_url && (
          <div className="relative aspect-[16/9] sm:aspect-[3/1] bg-slate-200 dark:bg-slate-800">
            <Image
              src={site.cover_image_url}
              alt={`${site.name} 조감도`}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        )}
        <div className="px-4 -mt-16 sm:-mt-20 relative z-10">
          <div className="max-w-3xl mx-auto">
            {(site as any).brand_name && (
              <div className="text-xs font-bold text-white/90 mb-1 drop-shadow">
                {String((site as any).brand_name)}
              </div>
            )}
            <h1 className="text-2xl sm:text-4xl font-black text-white drop-shadow-lg leading-tight">
              {site.name}
            </h1>
            <div className="text-sm text-white/90 mt-1 drop-shadow">
              {[site.region, site.sigungu, site.dong].filter(Boolean).join(' ')}
              {site.builder && <> · {site.builder}</>}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 mt-6 sm:mt-8 space-y-8">
        {(sub?.rcept_bgnde || sub?.rcept_endde || sub?.przwner_presnatn_de) && (
          <DDayCountdown
            rcept_bgnde={sub?.rcept_bgnde}
            rcept_endde={sub?.rcept_endde}
            przwner_presnatn_de={sub?.przwner_presnatn_de}
          />
        )}

        <div className="hidden sm:block">
          <PrimaryCTABar slug={site.slug} siteName={site.name} isAuthed={isAuthed} />
        </div>

        <section aria-label="핵심 정보">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Fact label="총 세대" value={site.total_units ? `${site.total_units}세대` : '—'} />
            <Fact label="평형" value={houseTypes.length > 0 ? `${houseTypes.length}개 타입` : '—'} />
            <Fact label="입주 예정" value={formatYearMonth(sub?.mvn_prearnge_ym)} />
            <Fact label="분양가" value={site.price_min && site.price_max ? `${formatKoreanPrice(site.price_min)}~${formatKoreanPrice(site.price_max)}` : '—'} />
            <Fact label="시공" value={site.builder || '—'} />
            <Fact label="시행" value={site.developer || '—'} />
          </div>
        </section>

        {(sub?.ai_summary || analysisText) && (
          <section className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
            <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
              <span aria-hidden="true">▸</span>
              <span>카더라 AI 분석</span>
            </h2>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {sub?.ai_summary || (analysisText && analysisText.split('\n').slice(0, 4).join('\n'))}
            </p>
          </section>
        )}

        <section id="price" aria-label="분양가 분석" className="space-y-4 scroll-mt-16">
          <h2 className="text-xl font-bold">분양가 · 시세 분석</h2>

          {site.price_min && site.price_max && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-slate-500">평형별 최저~최고</span>
                {sub?.price_per_pyeong_avg && (
                  <span className="text-xs text-slate-500">
                    평당 평균 {formatPyeongPrice(sub.price_per_pyeong_avg)}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold">
                {formatKoreanPrice(site.price_min)} ~ {formatKoreanPrice(site.price_max)}
              </div>
            </div>
          )}

          {supplyBreakdown.length > 0 && (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-2 text-left">타입</th>
                    <th className="py-2 px-2 text-right">전용</th>
                    <th className="py-2 px-2 text-right">세대</th>
                    <th className="py-2 px-2 text-right">분양가(최고)</th>
                  </tr>
                </thead>
                <tbody>
                  {houseTypes.map((t: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 px-2 font-medium">{t.type || '—'}</td>
                      <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                        {t.area ? `${parseFloat(String(t.area)).toFixed(1)}㎡` : '—'}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                        {t.supply || '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold">
                        {t.lttot_top_amount ? `${(t.lttot_top_amount / 10000).toFixed(2)}억` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {site.estimated_safe_margin != null && (
            <LockedSection label="인근 시세 대비 안전마진" source="apt_safe_margin">
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">인근 입주 단지 평균 대비</div>
                <div className={`text-3xl font-bold ${site.estimated_safe_margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatMargin(site.estimated_safe_margin)}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  카더라 자체 분석 — 인근 동 입주 5년차 단지의 최근 1년 실거래 평균과 비교
                </p>
              </div>
            </LockedSection>
          )}

          {sub?.expected_competition != null && (
            <LockedSection label="청약 경쟁률 AI 예측" source="apt_competition">
              <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">예상 경쟁률</div>
                <div className="text-3xl font-bold text-orange-600">
                  {sub.expected_competition}:1
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  과거 인근 권역 유사 단지 1순위 청약 경쟁률 + 현재 시장 분위기 종합 추정
                </p>
              </div>
            </LockedSection>
          )}

          {paymentSchedule && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3">결제 스케줄</h3>
              <div className="grid grid-cols-3 gap-2">
                <PaymentCell label={paymentSchedule.deposit?.label || '계약금'} pct={paymentSchedule.deposit?.pct} amount={paymentSchedule.deposit?.amount} />
                <PaymentCell label={paymentSchedule.interim?.label || '중도금'} pct={paymentSchedule.interim?.pct} amount={paymentSchedule.interim?.amount} />
                <PaymentCell label={paymentSchedule.balance?.label || '잔금'} pct={paymentSchedule.balance?.pct} amount={paymentSchedule.balance?.amount} />
              </div>
            </div>
          )}
        </section>

        <section id="floorplan" aria-label="평면도" className="space-y-4 scroll-mt-16">
          <h2 className="text-xl font-bold">평면도</h2>
          <FloorPlanGallery types={houseTypes} floorPlanImages={(sub?.floor_plan_images as Record<string, string>) || undefined} />
        </section>

        <section id="schedule" aria-label="청약 일정" className="scroll-mt-16">
          <h2 className="text-xl font-bold mb-4">청약 일정</h2>
          <ol className="space-y-2">
            <ScheduleStep label="입주자 모집공고" date={sub?.fetched_at ? formatDate(sub.fetched_at.slice(0, 10)) : '—'} />
            <ScheduleStep label="특별공급" date={formatDate(sub?.spsply_rcept_bgnde)} />
            <ScheduleStep label="1순위 청약" date={formatDate(sub?.rcept_bgnde)} highlight />
            <ScheduleStep label="2순위 청약" date={formatDate(sub?.rcept_endde)} />
            <ScheduleStep label="당첨자 발표" date={formatDate(sub?.przwner_presnatn_de)} />
            <ScheduleStep label="정당 계약" date={sub?.cntrct_cncls_bgnde && sub.cntrct_cncls_endde ? `${formatDate(sub.cntrct_cncls_bgnde)} ~ ${formatDate(sub.cntrct_cncls_endde)}` : '—'} />
            <ScheduleStep label="입주 예정" date={formatYearMonth(sub?.mvn_prearnge_ym)} />
          </ol>
        </section>

        <section id="modelhouse" aria-label="모델하우스" className="space-y-4 scroll-mt-16">
          <h2 className="text-xl font-bold">모델하우스</h2>
          {site.address && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">주소</div>
              <div className="text-sm font-medium mb-3">{site.address}</div>
              <div className="flex gap-2">
                <a href={`https://map.kakao.com/?q=${encodeURIComponent(site.name + ' 모델하우스')}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded-lg">
                  카카오맵 ▸
                </a>
                <a href={`https://map.naver.com/p/search/${encodeURIComponent(site.name + ' 모델하우스')}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs font-medium py-2 bg-green-100 hover:bg-green-200 text-green-900 rounded-lg">
                  네이버지도 ▸
                </a>
              </div>
            </div>
          )}
          {site.vr_url && (
            <a href={site.vr_url} target="_blank" rel="noopener noreferrer" className="block w-full bg-slate-900 text-white text-center py-3 rounded-xl font-bold">
              사이버 모델하우스 ▸
            </a>
          )}
        </section>

        {keyFeatures && keyFeatures.length > 0 && (
          <section aria-label="단지 특징">
            <h2 className="text-xl font-bold mb-3">단지 특징</h2>
            <div className="flex flex-wrap gap-2">
              {keyFeatures.map((f, i) => (
                <span key={i} className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </section>
        )}

        {nearbyFacilities && (
          <section aria-label="주변 편의시설" className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
            <h3 className="text-sm font-bold mb-3">주변 편의시설</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <FacilityCell label="지하철" count={nearbyFacilities.subway} />
              <FacilityCell label="학교" count={nearbyFacilities.school} />
              <FacilityCell label="마트" count={nearbyFacilities.mart} />
              <FacilityCell label="병원" count={nearbyFacilities.hospital} />
              <FacilityCell label="공원" count={nearbyFacilities.park} />
            </div>
          </section>
        )}

        {analysisText && analysisText.length > 200 && (
          <details className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 group">
            <summary className="font-bold text-sm cursor-pointer flex items-center justify-between">
              <span>카더라 종합 분석 전문 보기</span>
              <span className="text-slate-400 group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
            </summary>
            <div className="mt-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-line text-slate-700 dark:text-slate-300">
              {analysisText}
            </div>
          </details>
        )}

        <section id="reviews" aria-label="후기" className="scroll-mt-16">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">후기</h2>
            {data.reviews_count > 0 && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {data.reviews_avg_rating}/5.0 · {data.reviews_count}건
              </div>
            )}
          </div>
          {data.reviews_count === 0 ? (
            <div className="text-sm text-slate-500 text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-xl">
              아직 후기가 없습니다 — 첫 후기를 남겨주세요
            </div>
          ) : (
            <Link href={`/apt/${encodeURIComponent(site.slug)}/후기`} className="block text-center text-sm font-medium py-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900">
              전체 후기 {data.reviews_count}건 보기 ▸
            </Link>
          )}
        </section>

        <section id="faq" aria-label="자주 묻는 질문" className="scroll-mt-16">
          <h2 className="text-xl font-bold mb-4">자주 묻는 질문</h2>
          <FAQAccordion faqs={faqs} />
        </section>

        {data.related_blogs && data.related_blogs.length > 0 && (
          <section aria-label="관련 블로그">
            <h2 className="text-xl font-bold mb-3">관련 분석</h2>
            <ul className="space-y-2">
              {data.related_blogs.map((b) => (
                <li key={b.post_id}>
                  <Link href={`/blog/${b.post_id}`} className="block px-4 py-3 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm">
                    {b.anchor_text} ▸
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.agent_info?.kakao_url && (
          <section className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
            <h3 className="text-sm font-bold mb-2">분양 영업 문의</h3>
            <a href={data.agent_info.kakao_url} target="_blank" rel="noopener noreferrer" className="block w-full bg-yellow-300 hover:bg-yellow-400 text-black text-center font-bold py-3 rounded-xl">
              카카오톡 1:1 상담 ▸
            </a>
          </section>
        )}

        <footer className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-1">
          {sub?.house_manage_no && (
            <p>청약홈 공고번호: <code className="text-slate-700 dark:text-slate-300">{sub.house_manage_no}</code></p>
          )}
          {sub?.pblanc_url && (
            <p>
              <a href={sub.pblanc_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                청약홈 공고 원문 ▸
              </a>
            </p>
          )}
          <p>마지막 업데이트: {formatRelativeTime(site.updated_at || sub?.updated_at)}</p>
          <p className="leading-relaxed mt-2">
            본 정보는 청약홈 입주자 모집공고 기준이며, 분양가·일정·옵션·계약 조건은 변동 가능합니다. 최종 확정은 반드시 공식 분양 문서로 확인해 주세요. 카더라 자체 분석(안전마진·경쟁률 예측)은 참고용 정보이며 투자 권유가 아닙니다.
          </p>
        </footer>
      </div>

      <StickyBottomBar slug={site.slug} siteName={site.name} isAuthed={isAuthed} rcept_bgnde={sub?.rcept_bgnde} />
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function PaymentCell({ label, pct, amount }: { label: string; pct?: number; amount?: number }) {
  return (
    <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-xs font-bold">{pct ?? '—'}%</div>
      {amount && (
        <div className="text-[10px] text-slate-600 dark:text-slate-400">
          {(amount / 10000).toFixed(2)}억
        </div>
      )}
    </div>
  );
}

function ScheduleStep({ label, date, highlight }: { label: string; date: string; highlight?: boolean }) {
  return (
    <li className={`flex justify-between items-center py-2.5 px-4 rounded-lg ${highlight ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-900'}`}>
      <span className="text-sm font-medium">{label}</span>
      <time className="text-sm text-slate-700 dark:text-slate-300">{date}</time>
    </li>
  );
}

function FacilityCell({ label, count }: { label: string; count?: number }) {
  return (
    <div>
      <div className="text-2xl font-bold">{count ?? 0}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
