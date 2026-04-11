/**
 * Stock Logo System
 * 국내 주요 기업 브랜드 컬러 + 이니셜, 해외 기업 Clearbit 로고 fallback
 */

const KR_BRANDS: Record<string, { initials: string; bg: string }> = {
  '005930': { initials: '삼성', bg: '#1428A0' },
  '000660': { initials: 'SK', bg: '#E31937' },
  '005380': { initials: 'H', bg: '#002C5F' },
  '005490': { initials: 'P', bg: '#003893' },
  '035420': { initials: 'N', bg: '#03C75A' },
  '035720': { initials: 'K', bg: '#FAE100' },
  '051910': { initials: 'LG', bg: '#A50034' },
  '006400': { initials: '삼SDI', bg: '#1428A0' },
  '373220': { initials: 'LG', bg: '#A50034' },
  '207940': { initials: '삼바', bg: '#1428A0' },
  '000270': { initials: '기아', bg: '#05141F' },
  '068270': { initials: '셀트', bg: '#00A1E0' },
  '028260': { initials: '삼E', bg: '#1428A0' },
  '105560': { initials: 'KB', bg: '#FFB300' },
  '055550': { initials: '신한', bg: '#0046FF' },
  '003670': { initials: 'P&S', bg: '#003893' },
  '096770': { initials: 'SK이노', bg: '#E31937' },
  '034730': { initials: 'SK', bg: '#E31937' },
  '066570': { initials: 'LG전', bg: '#A50034' },
  '003550': { initials: 'LG', bg: '#A50034' },
  '012330': { initials: '현대모', bg: '#002C5F' },
  '009150': { initials: '삼전기', bg: '#1428A0' },
  '017670': { initials: 'SK텔', bg: '#E31937' },
  '030200': { initials: 'KT', bg: '#E31937' },
  '032830': { initials: '삼생', bg: '#0072CE' },
  '316140': { initials: '우리금', bg: '#005BAA' },
  '086790': { initials: '하나금', bg: '#009775' },
  '018260': { initials: '삼SDS', bg: '#1428A0' },
  '011200': { initials: 'HMM', bg: '#004C97' },
  '010130': { initials: '고려아연', bg: '#1B365D' },
  '034020': { initials: '두산에', bg: '#1A1A2E' },
  '247540': { initials: '에코', bg: '#00B382' },
  '361610': { initials: 'SK아이', bg: '#E31937' },
  '003490': { initials: '대한항', bg: '#00256C' },
  '259960': { initials: '크래프', bg: '#FF6600' },
  '036570': { initials: 'NC', bg: '#1B1464' },
  '263750': { initials: '펄어비스', bg: '#1A1A2E' },
  '293490': { initials: '카카오게', bg: '#FAE100' },
  '352820': { initials: '하이브', bg: '#000000' },
  '041510': { initials: 'SM', bg: '#FF1493' },
  '122870': { initials: 'YG', bg: '#000000' },
  '047810': { initials: 'JYP', bg: '#0050AA' },
};

const US_DOMAINS: Record<string, string> = {
  'AAPL': 'apple.com', 'MSFT': 'microsoft.com', 'GOOGL': 'google.com',
  'AMZN': 'amazon.com', 'NVDA': 'nvidia.com', 'META': 'meta.com',
  'TSLA': 'tesla.com', 'BRK.B': 'berkshirehathaway.com', 'JPM': 'jpmorganchase.com',
  'V': 'visa.com', 'UNH': 'unitedhealthgroup.com', 'MA': 'mastercard.com',
  'JNJ': 'jnj.com', 'HD': 'homedepot.com', 'PG': 'pg.com',
  'AVGO': 'broadcom.com', 'COST': 'costco.com', 'MRK': 'merck.com',
  'ABBV': 'abbvie.com', 'KO': 'coca-cola.com', 'PEP': 'pepsico.com',
  'ADBE': 'adobe.com', 'CRM': 'salesforce.com', 'WMT': 'walmart.com',
  'TMO': 'thermofisher.com', 'NFLX': 'netflix.com', 'AMD': 'amd.com',
  'DIS': 'disney.com', 'INTC': 'intel.com', 'QCOM': 'qualcomm.com',
  'CSCO': 'cisco.com', 'NKE': 'nike.com', 'BA': 'boeing.com',
  'IBM': 'ibm.com', 'GS': 'goldmansachs.com', 'CAT': 'caterpillar.com',
  'ORCL': 'oracle.com', 'MCD': 'mcdonalds.com', 'UBER': 'uber.com',
  'ABNB': 'airbnb.com', 'PYPL': 'paypal.com', 'SQ': 'block.xyz',
  'COIN': 'coinbase.com', 'SNOW': 'snowflake.com', 'PLTR': 'palantir.com',
  'ARM': 'arm.com', 'SMCI': 'supermicro.com', 'TSM': 'tsmc.com',
  'SHOP': 'shopify.com', 'SPOT': 'spotify.com', 'SNAP': 'snapchat.com',
  'RBLX': 'roblox.com', 'RIVN': 'rivian.com', 'LCID': 'lucidmotors.com',
};

const US_BRANDS: Record<string, { initials: string; bg: string }> = {
  'AAPL': { initials: '', bg: '#000000' },
  'MSFT': { initials: 'M', bg: '#00A4EF' },
  'GOOGL': { initials: 'G', bg: '#4285F4' },
  'AMZN': { initials: 'a', bg: '#FF9900' },
  'NVDA': { initials: 'N', bg: '#76B900' },
  'META': { initials: 'M', bg: '#0081FB' },
  'TSLA': { initials: 'T', bg: '#CC0000' },
  'NFLX': { initials: 'N', bg: '#E50914' },
};

/**
 * 로고 렌더링에 필요한 데이터 반환
 */
export function getStockLogo(symbol: string, isKR: boolean): {
  type: 'initials';
  initials: string;
  bg: string;
  textColor: string;
} {
  if (isKR) {
    const brand = KR_BRANDS[symbol];
    if (brand) {
      return { type: 'initials', initials: brand.initials, bg: brand.bg, textColor: '#fff' };
    }
    // fallback: 종목코드 기반 해시 컬러
    return {
      type: 'initials',
      initials: symbol.slice(0, 3),
      bg: hashColor(symbol),
      textColor: '#fff',
    };
  }

  const usBrand = US_BRANDS[symbol];
  if (usBrand) {
    return { type: 'initials', initials: usBrand.initials, bg: usBrand.bg, textColor: '#fff' };
  }

  return {
    type: 'initials',
    initials: symbol.slice(0, 2),
    bg: hashColor(symbol),
    textColor: '#fff',
  };
}

/**
 * Clearbit 로고 URL (해외 종목용)
 */
export function getClearbitLogoUrl(symbol: string): string | null {
  const domain = US_DOMAINS[symbol];
  return domain ? `https://logo.clearbit.com/${domain}` : null;
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#1E40AF', '#7C3AED', '#0F766E', '#B45309',
    '#1D4ED8', '#6D28D9', '#047857', '#92400E',
    '#1E3A5F', '#4C1D95', '#065F46', '#78350F',
  ];
  return colors[Math.abs(hash) % colors.length];
}
