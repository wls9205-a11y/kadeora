-- 게시글에 해시태그 컬럼 추가 (이미 있으면 무시)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}';

-- 종목 추가 (코스닥 주요 + 해외 추가)
INSERT INTO stock_quotes (symbol, name, market, currency, price, change_amt, change_pct, volume, market_cap)
VALUES
('WMT','월마트','NYSE','USD',90.5,0,0,0,720000000000),
('DIS','월트디즈니','NYSE','USD',95.2,0,0,0,175000000000),
('PYPL','페이팔','NASDAQ','USD',68.4,0,0,0,72000000000),
('UBER','우버','NYSE','USD',78.3,0,0,0,165000000000),
('ABNB','에어비앤비','NASDAQ','USD',145.2,0,0,0,93000000000),
('SHOP','쇼피파이','NYSE','USD',88.6,0,0,0,115000000000),
('BABA','알리바바','NYSE','USD',88.5,0,0,0,210000000000),
('NIO','니오','NYSE','USD',4.3,0,0,0,8500000000),
('RIVN','리비안','NASDAQ','USD',12.8,0,0,0,13000000000)
ON CONFLICT (symbol) DO NOTHING;

-- 해당 종목 토론방 생성
INSERT INTO discussion_rooms (room_key, display_name, room_type, is_active)
SELECT
  symbol,
  name || ' 토론방',
  CASE WHEN currency = 'USD' THEN 'us_stock' ELSE 'stock' END,
  true
FROM stock_quotes
WHERE symbol IN ('WMT','DIS','PYPL','UBER','ABNB','SHOP','BABA','NIO','RIVN')
ON CONFLICT (room_key) DO NOTHING;
