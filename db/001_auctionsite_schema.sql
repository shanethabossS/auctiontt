BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS api.auction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api.sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  verified boolean NOT NULL DEFAULT false,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  total_sales integer NOT NULL DEFAULT 0,
  location_city text,
  location_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rating >= 0 AND rating <= 5)
);

CREATE TABLE IF NOT EXISTS api.auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES api.sellers(id) ON DELETE CASCADE,
  category_id uuid REFERENCES api.auction_categories(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  auction_type text NOT NULL DEFAULT 'online_only',
  status text NOT NULL DEFAULT 'scheduled',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  city text,
  state text,
  pickup_available boolean NOT NULL DEFAULT true,
  shipping_available boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (auction_type IN ('online_only', 'live', 'webcast', 'absentee')),
  CHECK (status IN ('scheduled', 'live', 'closed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS api.lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES api.auctions(id) ON DELETE CASCADE,
  lot_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  reserve_price numeric(12,2) NOT NULL DEFAULT 0,
  starting_bid numeric(12,2) NOT NULL DEFAULT 1,
  current_bid numeric(12,2) NOT NULL DEFAULT 0,
  bid_count integer NOT NULL DEFAULT 0,
  condition_grade text,
  is_featured boolean NOT NULL DEFAULT false,
  is_hot boolean NOT NULL DEFAULT false,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, lot_number),
  CHECK (reserve_price >= 0),
  CHECK (starting_bid >= 0),
  CHECK (current_bid >= 0),
  CHECK (bid_count >= 0)
);

CREATE TABLE IF NOT EXISTS api.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES api.lots(id) ON DELETE CASCADE,
  bidder_name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  placed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS api.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  lot_id uuid NOT NULL REFERENCES api.lots(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, lot_id)
);

CREATE INDEX IF NOT EXISTS idx_auctions_status_end ON api.auctions(status, ends_at DESC);
CREATE INDEX IF NOT EXISTS idx_lots_hot_end ON api.lots(is_hot, ends_at DESC);
CREATE INDEX IF NOT EXISTS idx_lots_title_search ON api.lots USING gin (to_tsvector('english', title || ' ' || description));
CREATE INDEX IF NOT EXISTS idx_bids_lot_placed ON api.bids(lot_id, placed_at DESC);

CREATE OR REPLACE VIEW api.v_lot_feed AS
SELECT
  l.id,
  l.auction_id,
  a.title AS auction_title,
  l.lot_number,
  l.title,
  l.description,
  l.image_url,
  l.current_bid,
  l.starting_bid,
  l.bid_count,
  l.is_featured,
  l.is_hot,
  l.ends_at,
  a.city,
  a.state,
  a.shipping_available,
  a.pickup_available,
  s.display_name AS seller_name,
  s.verified AS seller_verified,
  c.slug AS category_slug,
  c.name AS category_name
FROM api.lots l
JOIN api.auctions a ON a.id = l.auction_id
JOIN api.sellers s ON s.id = a.seller_id
LEFT JOIN api.auction_categories c ON c.id = a.category_id
WHERE a.status IN ('live', 'scheduled');

CREATE OR REPLACE FUNCTION api.place_bid(p_lot_id uuid, p_bidder_name text, p_amount numeric)
RETURNS api.lots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_lot api.lots;
  v_min_bid numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Bid amount must be greater than zero';
  END IF;

  SELECT * INTO v_lot
  FROM api.lots
  WHERE id = p_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot not found';
  END IF;

  IF v_lot.ends_at <= now() THEN
    RAISE EXCEPTION 'Auction lot has ended';
  END IF;

  v_min_bid := GREATEST(v_lot.current_bid + 1, v_lot.starting_bid);

  IF p_amount < v_min_bid THEN
    RAISE EXCEPTION 'Bid must be at least %', v_min_bid;
  END IF;

  INSERT INTO api.bids(lot_id, bidder_name, amount)
  VALUES (p_lot_id, p_bidder_name, p_amount);

  UPDATE api.lots
  SET current_bid = p_amount,
      bid_count = bid_count + 1
  WHERE id = p_lot_id
  RETURNING * INTO v_lot;

  RETURN v_lot;
END;
$$;

ALTER TABLE api.auction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_select_anon ON api.auction_categories;
CREATE POLICY category_select_anon ON api.auction_categories FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS seller_select_anon ON api.sellers;
CREATE POLICY seller_select_anon ON api.sellers FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS auction_select_anon ON api.auctions;
CREATE POLICY auction_select_anon ON api.auctions FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS lot_select_anon ON api.lots;
CREATE POLICY lot_select_anon ON api.lots FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS bid_select_anon ON api.bids;
CREATE POLICY bid_select_anon ON api.bids FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS watchlist_insert_anon ON api.watchlists;
CREATE POLICY watchlist_insert_anon ON api.watchlists FOR INSERT TO web_anon WITH CHECK (true);

DROP POLICY IF EXISTS watchlist_select_anon ON api.watchlists;
CREATE POLICY watchlist_select_anon ON api.watchlists FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS app_user_all_categories ON api.auction_categories;
CREATE POLICY app_user_all_categories ON api.auction_categories FOR ALL TO app_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_user_all_sellers ON api.sellers;
CREATE POLICY app_user_all_sellers ON api.sellers FOR ALL TO app_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_user_all_auctions ON api.auctions;
CREATE POLICY app_user_all_auctions ON api.auctions FOR ALL TO app_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_user_all_lots ON api.lots;
CREATE POLICY app_user_all_lots ON api.lots FOR ALL TO app_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_user_all_bids ON api.bids;
CREATE POLICY app_user_all_bids ON api.bids FOR ALL TO app_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_user_all_watchlists ON api.watchlists;
CREATE POLICY app_user_all_watchlists ON api.watchlists FOR ALL TO app_user USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA api TO web_anon, app_user;
GRANT SELECT ON api.v_lot_feed TO web_anon, app_user;
GRANT EXECUTE ON FUNCTION api.place_bid(uuid, text, numeric) TO web_anon, app_user;

GRANT SELECT ON ALL TABLES IN SCHEMA api TO web_anon;
GRANT INSERT ON api.watchlists TO web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO web_anon, app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT USAGE, SELECT ON SEQUENCES TO web_anon, app_user;

INSERT INTO api.auction_categories (slug, name, icon, sort_order)
VALUES
  ('electronics', 'Electronics', 'cpu', 1),
  ('vehicle-parts', 'Vehicle Parts', 'car', 2),
  ('tools', 'Tools', 'wrench', 3),
  ('appliances', 'Appliances', 'plug', 4),
  ('furniture', 'Furniture', 'sofa', 5),
  ('business-equipment', 'Business Equipment', 'briefcase', 6),
  ('liquidation-stock', 'Liquidation Stock', 'boxes', 7),
  ('clearance-deals', 'Clearance Deals', 'tag', 8)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO api.sellers (display_name, slug, verified, rating, total_sales, location_city, location_state)
VALUES
  ('[DEMO] AuctionTT Chaguanas Deals Hub', 'demo-auctiontt-chaguanas', true, 4.8, 1242, 'Chaguanas', 'Trinidad'),
  ('[DEMO] AuctionTT South Liquidators', 'demo-auctiontt-south', true, 4.6, 912, 'San Fernando', 'Trinidad'),
  ('[DEMO] AuctionTT Tobago Trade House', 'demo-auctiontt-tobago', true, 4.5, 540, 'Scarborough', 'Tobago')
ON CONFLICT (slug) DO NOTHING;

DELETE FROM api.watchlists w
USING api.lots l
JOIN api.auctions a ON a.id = l.auction_id
WHERE w.lot_id = l.id
  AND a.title IN ('[DEMO] AuctionTT Electronics Liquidation', '[DEMO] AuctionTT Vehicle Parts Event', '[DEMO] AuctionTT Tools & Appliances Weekend');

DELETE FROM api.bids b
USING api.lots l
JOIN api.auctions a ON a.id = l.auction_id
WHERE b.lot_id = l.id
  AND a.title IN ('[DEMO] AuctionTT Electronics Liquidation', '[DEMO] AuctionTT Vehicle Parts Event', '[DEMO] AuctionTT Tools & Appliances Weekend');

DELETE FROM api.lots l
USING api.auctions a
WHERE l.auction_id = a.id
  AND a.title IN ('[DEMO] AuctionTT Electronics Liquidation', '[DEMO] AuctionTT Vehicle Parts Event', '[DEMO] AuctionTT Tools & Appliances Weekend');

DELETE FROM api.auctions
WHERE title IN ('[DEMO] AuctionTT Electronics Liquidation', '[DEMO] AuctionTT Vehicle Parts Event', '[DEMO] AuctionTT Tools & Appliances Weekend');

WITH cat AS (
  SELECT slug, id FROM api.auction_categories
), sel AS (
  SELECT slug, id FROM api.sellers
)
INSERT INTO api.auctions (
  seller_id, category_id, title, description, auction_type, status,
  starts_at, ends_at, city, state, pickup_available, shipping_available
)
VALUES
  ((SELECT id FROM sel WHERE slug = 'demo-auctiontt-chaguanas'), (SELECT id FROM cat WHERE slug = 'electronics'),
    '[DEMO] AuctionTT Electronics Liquidation', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. Launch preview listings for Trinidad and Tobago.', 'online_only', 'live',
    now() - interval '2 hours', now() + interval '2 days', 'Chaguanas', 'Trinidad', true, true),
  ((SELECT id FROM sel WHERE slug = 'demo-auctiontt-south'), (SELECT id FROM cat WHERE slug = 'vehicle-parts'),
    '[DEMO] AuctionTT Vehicle Parts Event', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. Sample verified seller inventory for QA.', 'webcast', 'live',
    now() - interval '1 day', now() + interval '18 hours', 'San Fernando', 'Trinidad', true, true),
  ((SELECT id FROM sel WHERE slug = 'demo-auctiontt-tobago'), (SELECT id FROM cat WHERE slug = 'tools'),
    '[DEMO] AuctionTT Tools & Appliances Weekend', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. Example local bidding items for rollout testing.', 'online_only', 'scheduled',
    now() + interval '8 hours', now() + interval '3 days', 'Scarborough', 'Tobago', true, false)
ON CONFLICT DO NOTHING;

WITH a AS (
  SELECT id, title FROM api.auctions
)
INSERT INTO api.lots (
  auction_id, lot_number, title, description, image_url,
  reserve_price, starting_bid, current_bid, bid_count,
  condition_grade, is_featured, is_hot, ends_at
)
VALUES
  ((SELECT id FROM a WHERE title = '[DEMO] AuctionTT Electronics Liquidation'), 'E-101', '[DEMO] 55in Smart TV Bundle', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. Chaguanas sample listing for launch QA.', 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=1200&q=80', 2400, 900, 1380, 17, 'Good', true, true, now() + interval '9 hours'),
  ((SELECT id FROM a WHERE title = '[DEMO] AuctionTT Electronics Liquidation'), 'E-102', '[DEMO] Laptop Workstation Set', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. Trinidad preview inventory.', 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=1200&q=80', 3500, 1200, 1980, 22, 'Good', true, true, now() + interval '15 hours'),
  ((SELECT id FROM a WHERE title = '[DEMO] AuctionTT Vehicle Parts Event'), 'V-220', '[DEMO] Alloy Rim Set (4)', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. San Fernando sample for QA.', 'https://images.unsplash.com/photo-1486496572940-2bb2341fdbdf?auto=format&fit=crop&w=1200&q=80', 2200, 700, 1125, 26, 'Used', true, true, now() + interval '7 hours'),
  ((SELECT id FROM a WHERE title = '[DEMO] AuctionTT Vehicle Parts Event'), 'V-224', '[DEMO] Brake Kit & Rotors', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. Verified seller demo lot.', 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80', 900, 250, 640, 18, 'New', false, true, now() + interval '11 hours'),
  ((SELECT id FROM a WHERE title = '[DEMO] AuctionTT Tools & Appliances Weekend'), 'T-331', '[DEMO] Industrial Air Compressor', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. Tobago rollout sample.', 'https://images.unsplash.com/photo-1581093458791-9d42e2f8f273?auto=format&fit=crop&w=1200&q=80', 1200, 300, 540, 9, 'Good', false, false, now() + interval '2 days'),
  ((SELECT id FROM a WHERE title = '[DEMO] AuctionTT Tools & Appliances Weekend'), 'A-339', '[DEMO] Commercial Blender Pack', 'DEMO DATA ONLY - NOT A REAL LISTING OR OFFER. Example appliance listing for launch preview.', 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=1200&q=80', 800, 200, 420, 11, 'Good', false, false, now() + interval '2 days 4 hours')
ON CONFLICT (auction_id, lot_number) DO NOTHING;

INSERT INTO api.bids (lot_id, bidder_name, amount)
SELECT id, 'demo_bidder', current_bid
FROM api.lots
WHERE current_bid > 0
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
