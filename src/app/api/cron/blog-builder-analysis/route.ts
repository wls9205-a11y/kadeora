export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface Subscription {
  constructor_nm: string;
  developer_nm: string | null;
  house_nm: string;
  region_nm: string;
  supply_addr: string | null;
  tot_supply_hshld_co: number | null;
  rcept_bgnde: string | null;
  mvn_prearnge_ym: string | null;
  price_per_pyeong: number | null;
}

const BUILDER_BRANDS: Record<string, string> = {
  '대우건설': '푸르지오',
  '지에스건설': '자이(Xi)',
  '현대건설': '힐스테이트',
  '롯데건설': '롯데캐슬',
  '서희건설': '서희스타힐스',
  '호반건설': '호반써밋',
  '포스코건설': '더샵',
  '포스코이앤씨': '더샵',
  '현대엔지니어링': '힐스테이트',
  '에이치디씨현대산업개발': 'IPARK',
  '한화건설': '한화포레나',
  '쌍용건설': '더플래티넘',
  '태영건설': '데시앙',
  '디엘건설': 'e편한세상',
  '디엘이앤씨': 'e편한세상',
  '삼성물산': '래미안',
  '코오롱글로벌': '하늘채',
  '반도건설': '유보라',
  '두산건설': '위브',
};

const BUILDER_SLUG_MAP: Record<string, string> = {
  '(주)대우건설': 'daewoo',
  '지에스건설': 'gs',
  '현대건설': 'hyundai',
  '롯데건설': 'lotte',
  '(주)서희건설': 'seohee',
  '(주)호반건설': 'hoban',
  '(주)포스코건설': 'posco',
  '제일건설': 'jeil',
  '현대엔지니어링': 'hyundai-eng',
  '한신공영': 'hanshin',
  '(주)포스코이앤씨': 'posco-enc',
  '코오롱글로벌': 'kolon',
  '중흥토건': 'jungheung',
  '에이치디씨현대산업개발': 'hdc',
  '계룡건설산업': 'gyeryong',
  '(주)한화건설': 'hanwha',
  '쌍용건설': 'ssangyong',
  '(주)태영건설': 'taeyoung',
  '디엘건설': 'dl',
  '디엘이앤씨': 'dl-enc',
  '우미건설': 'woomi',
  '두산건설': 'doosan',
  '(주)반도건설': 'bando',
  '동부건설': 'dongbu',
  '삼성물산': 'samsung',
};

const TOP_BUILDERS = [
  '(주)대우건설',
  '지에스건설',
  '현대건설',
  '롯데건설',
  '(주)서희건설',
  '(주)호반건설',
  '(주)포스코건설',
  '제일건설',
  '현대엔지니어링',
  '한신공영',
  '(주)포스코이앤씨',
  '코오롱글로벌',
  '중흥토건',
  '에이치디씨현대산업개발',
  '계룡건설산업',
  '(주)한화건설',
  '쌍용건설',
  '(주)태영건설',
  '디엘건설',
  '디엘이앤씨',
  '우미건설',
  '두산건설',
  '(주)반도건설',
  '동부건설',
  '삼성물산',
] as const;

function getBrandName(constructorNm: string): string {
  for (const [key, brand] of Object.entries(BUILDER_BRANDS)) {
    if (constructorNm.includes(key)) return brand;
  }
  return constructorNm;
}

function getSlug(constructorNm: string): string {
  return BUILDER_SLUG_MAP[constructorNm] || constructorNm.replace(/[()주]/g, '').trim().replace(/\s+/g, '-');
}

function getSearchKeyword(constructorNm: string): string {
  // Strip (주) prefix for ILIKE search
  return constructorNm.replace(/^\(주\)/, '').trim();
}

function formatPrice(val: number | null): string {
  if (!val) return '-';
  if (val >= 10000) {
    const eok = Math.floor(val / 10000);
    const remainder = val % 10000;
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${val.toLocaleString()}만원`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  // Handle "YYYYMMDD" or "YYYY-MM-DD"
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
  }
  return dateStr.replace(/-/g, '.');
}

function formatMoveIn(ym: string | null): string {
  if (!ym) return '-';
  // Handle "YYYYMM" or "YYYY-MM"
  const cleaned = ym.replace(/-/g, '');
  if (cleaned.length >= 6) {
    return `${cleaned.slice(0, 4)}년 ${parseInt(cleaned.slice(4, 6), 10)}월`;
  }
  return ym;
}

function buildContent(
  constructorNm: string,
  brand: string,
  projects: Subscription[],
): string {
  const parts: string[] = [];

  const totalSupply = projects.reduce((sum, p) => sum + (p.tot_supply_hshld_co || 0), 0);
  const projectCount = projects.length;

  parts.push(`## ${brand} 분양 일정 2026 총정리`);
  parts.push('');
  parts.push(`${constructorNm}의 브랜드 **${brand}** 아파트 분양 일정과 단지 정보를 총정리합니다. 분양가, 입지, 세대수 등 핵심 정보를 비교 분석했습니다.`);
  parts.push('');

  // Builder overview
  parts.push(`### 🏗️ ${constructorNm} 개요`);
  parts.push('');
  parts.push('| 항목 | 내용 |');
  parts.push('|---|---|');
  parts.push(`| 건설사 | ${constructorNm} |`);
  parts.push(`| 브랜드 | ${brand} |`);
  parts.push(`| 총 분양 단지 | ${projectCount}개 |`);
  parts.push(`| 총 공급 세대 | ${totalSupply.toLocaleString()}세대 |`);
  parts.push('');

  // Timeline table
  const sortedProjects = [...projects].sort((a, b) => {
    const dateA = a.rcept_bgnde || '99999999';
    const dateB = b.rcept_bgnde || '99999999';
    return dateA.localeCompare(dateB);
  });

  parts.push('### 📅 분양 타임라인');
  parts.push('');
  parts.push('| 단지명 | 지역 | 세대수 | 접수시작 | 입주예정 |');
  parts.push('|---|---|---|---|---|');
  for (const p of sortedProjects) {
    const supply = p.tot_supply_hshld_co ? `${p.tot_supply_hshld_co.toLocaleString()}세대` : '-';
    parts.push(`| ${p.house_nm} | ${p.region_nm} | ${supply} | ${formatDate(p.rcept_bgnde)} | ${formatMoveIn(p.mvn_prearnge_ym)} |`);
  }
  parts.push('');

  // Region distribution
  const regionCount: Record<string, { count: number; supply: number }> = {};
  for (const p of projects) {
    const region = p.region_nm || '기타';
    if (!regionCount[region]) regionCount[region] = { count: 0, supply: 0 };
    regionCount[region].count++;
    regionCount[region].supply += p.tot_supply_hshld_co || 0;
  }

  const regionEntries = Object.entries(regionCount).sort((a, b) => b[1].count - a[1].count);

  parts.push('### 📊 지역 분포');
  parts.push('');
  parts.push('| 지역 | 단지 수 | 공급 세대 |');
  parts.push('|---|---|---|');
  for (const [region, data] of regionEntries) {
    parts.push(`| ${region} | ${data.count}개 | ${data.supply.toLocaleString()}세대 |`);
  }
  parts.push('');

  // Price info if available
  const withPrice = projects.filter((p) => p.price_per_pyeong && p.price_per_pyeong > 0);
  if (withPrice.length > 0) {
    const avgPrice = Math.round(withPrice.reduce((sum, p) => sum + (p.price_per_pyeong || 0), 0) / withPrice.length);
    const maxPrice = Math.max(...withPrice.map((p) => p.price_per_pyeong || 0));
    const minPrice = Math.min(...withPrice.map((p) => p.price_per_pyeong || 0));

    parts.push('### 💰 분양가 정보');
    parts.push('');
    parts.push('| 항목 | 평당가 |');
    parts.push('|---|---|');
    parts.push(`| 평균 | ${formatPrice(avgPrice)}/평 |`);
    parts.push(`| 최고 | ${formatPrice(maxPrice)}/평 |`);
    parts.push(`| 최저 | ${formatPrice(minPrice)}/평 |`);
    parts.push('');
  }

  // Analysis
  parts.push('### 🔍 브랜드 분석');
  parts.push('');

  const topRegion = regionEntries[0];
  parts.push(`${constructorNm}(${brand})은 총 **${projectCount}개 단지**, **${totalSupply.toLocaleString()}세대**의 분양 실적을 보유하고 있습니다. 가장 활발한 지역은 **${topRegion ? topRegion[0] : '-'}**으로 ${topRegion ? topRegion[1].count : 0}개 단지를 공급했습니다.`);
  parts.push('');

  if (brand === '푸르지오') {
    parts.push('대우건설의 푸르지오는 전국적으로 고른 공급을 이어가고 있으며, 중대형 단지 위주의 개발에 강점을 보이고 있습니다. 최근에는 친환경 설계와 커뮤니티 시설 강화에 주력하고 있습니다.');
  } else if (brand === '자이(Xi)') {
    parts.push('GS건설의 자이(Xi)는 프리미엄 브랜드 이미지를 바탕으로 도심 핵심 입지에 강점을 보이고 있습니다. 차별화된 설계와 조경으로 높은 브랜드 프리미엄을 형성하고 있습니다.');
  } else if (brand === '힐스테이트') {
    parts.push('현대건설의 힐스테이트는 국내 시공능력 상위권의 기술력을 바탕으로 대규모 단지 개발에 강점을 가지고 있습니다. 스마트홈 시스템과 친환경 설계가 특징입니다.');
  } else if (brand === '롯데캐슬') {
    parts.push('롯데건설의 롯데캐슬은 롯데그룹의 인프라를 활용한 생활 편의성과 브랜드 신뢰도가 강점입니다. 상업시설 연계형 주거단지 개발에 노하우를 보유하고 있습니다.');
  } else if (brand === '래미안') {
    parts.push('삼성물산의 래미안은 국내 최고 프리미엄 아파트 브랜드 중 하나로, 강남권을 비롯한 핵심 입지에서 높은 시세를 형성하고 있습니다. 품질과 설계 완성도에서 시장을 선도하고 있습니다.');
  } else if (brand === 'e편한세상') {
    parts.push('DL건설의 e편한세상은 합리적인 분양가와 실용적인 설계로 실수요자에게 인기가 높은 브랜드입니다. 전국적으로 다양한 규모의 단지를 공급하고 있습니다.');
  } else if (brand === 'IPARK') {
    parts.push('HDC현대산업개발의 IPARK는 도시 중심부의 대규모 복합 개발에 강점을 보이는 프리미엄 브랜드입니다. 용산, 여의도 등 핵심 입지에서 랜드마크 단지를 개발해왔습니다.');
  } else if (brand === '더샵') {
    parts.push('포스코건설/포스코이앤씨의 더샵은 철강 기술력을 바탕으로 구조 안전성에 강점을 가진 브랜드입니다. 최근에는 친환경 인증과 에너지 효율에 주력하고 있습니다.');
  } else {
    parts.push(`${brand}는 꾸준한 분양 공급으로 시장에서 입지를 다져가고 있습니다. 지역별 특성을 반영한 단지 설계와 합리적인 분양가로 수요자의 관심을 받고 있습니다.`);
  }
  parts.push('');

  parts.push('청약을 고려하시는 분들은 단지별 분양가, 주변 시세, 교통 인프라, 학군 등을 종합적으로 비교 검토하시기 바랍니다.');
  parts.push('');

  // Internal links
  parts.push('### 관련 정보');
  parts.push('');
  parts.push(`- [청약 일정 →](${SITE_URL}/apt/subscriptions)`);
  parts.push(`- [카더라 블로그 →](${SITE_URL}/blog?category=apt)`);
  parts.push('');

  // Disclaimer
  parts.push('---');
  parts.push('');
  parts.push('> **면책고지**: 본 콘텐츠는 한국부동산원 청약홈 데이터를 기반으로 정보 제공 목적으로 작성되었으며, 특정 단지의 청약을 권유하지 않습니다. 분양 일정과 조건은 변경될 수 있으므로 반드시 해당 단지의 모집공고를 확인하시기 바랍니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.');

  return parts.join('\n');
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const offset = parseInt(params.get('offset') || '0', 10);
  const limit = parseInt(params.get('limit') || String(TOP_BUILDERS.length), 10);
  const targetBuilders = TOP_BUILDERS.slice(offset, offset + limit);

  const admin = getSupabaseAdmin();

  let created = 0;
  let skipped = 0;

  for (const constructorNm of targetBuilders) {
    try {
      const keyword = getSearchKeyword(constructorNm);
      const brand = getBrandName(constructorNm);
      const slugKey = getSlug(constructorNm);
      const slug = `builder-${slugKey}-2026-03`;

      // Query apt_subscriptions for this builder
      const { data: projects, error: projErr } = await admin
        .from('apt_subscriptions')
        .select('constructor_nm, developer_nm, house_nm, region_nm, supply_addr, tot_supply_hshld_co, rcept_bgnde, mvn_prearnge_ym, price_per_pyeong')
        .ilike('constructor_nm', `%${keyword}%`);

      if (projErr) {
        console.error(`[blog-builder-analysis] Query error for ${constructorNm}:`, projErr.message);
        skipped++;
        continue;
      }

      if (!projects || projects.length === 0) {
        skipped++;
        continue;
      }

      const subscriptions = projects as Subscription[];
      const title = `${brand} 분양 일정 2026 총정리 — ${constructorNm} 신규 단지 분양가와 입지 비교`;

      let content = buildContent(constructorNm, brand, subscriptions);
      content = ensureMinLength(content, 'apt', 1500);

      const tags = [brand, constructorNm, '분양', '청약', '아파트', '2026', '분양일정'];
      const totalSupply = subscriptions.reduce((sum, p) => sum + (p.tot_supply_hshld_co || 0), 0);

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content,
        excerpt: `${constructorNm}(${brand}) 분양 일정 2026 총정리 — 총 ${subscriptions.length}개 단지, ${totalSupply.toLocaleString()}세대 공급. 단지별 분양가와 입지 비교 분석.`,
        category: 'apt',
        tags,
        source_type: 'auto',
        cron_type: 'blog-builder-analysis',
        data_date: '2026-03',
        source_ref: 'apt_subscriptions',
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title&design=2)}&type=blog`,
        image_alt: generateImageAlt('apt', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', tags),
        is_published: true,
      });

      if (result.success) {
        created++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`[blog-builder-analysis] Error for ${constructorNm}:`, err.message);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: TOP_BUILDERS.length,
  });
});
