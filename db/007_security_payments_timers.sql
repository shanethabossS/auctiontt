BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

GRANT authenticated TO authenticator;

CREATE OR REPLACE FUNCTION api.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
$$;

CREATE OR REPLACE FUNCTION api.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
$$;

CREATE OR REPLACE FUNCTION api.server_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now()
$$;

ALTER TABLE api.bids
  ADD COLUMN IF NOT EXISTS bidder_user_id uuid REFERENCES api.site_users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS api.auth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES api.site_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON api.auth_refresh_tokens(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_revoked ON api.auth_refresh_tokens(revoked_at);

CREATE TABLE IF NOT EXISTS api.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES api.site_users(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES api.lots(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'fygaro',
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'TTD',
  status text NOT NULL DEFAULT 'pending',
  checkout_url text,
  provider_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount > 0),
  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON api.payment_orders(user_id, created_at DESC);

DROP POLICY IF EXISTS seller_profiles_insert_anon ON api.seller_profiles;
DROP POLICY IF EXISTS seller_profiles_update_anon ON api.seller_profiles;
DROP POLICY IF EXISTS seller_items_insert_anon ON api.seller_item_submissions;
DROP POLICY IF EXISTS watchlist_insert_anon ON api.watchlists;

DROP POLICY IF EXISTS seller_profiles_insert_auth ON api.seller_profiles;
CREATE POLICY seller_profiles_insert_auth
ON api.seller_profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = api.current_user_id());

DROP POLICY IF EXISTS seller_profiles_update_auth ON api.seller_profiles;
CREATE POLICY seller_profiles_update_auth
ON api.seller_profiles
FOR UPDATE
TO authenticated
USING (user_id = api.current_user_id())
WITH CHECK (user_id = api.current_user_id());

DROP POLICY IF EXISTS seller_items_insert_auth ON api.seller_item_submissions;
CREATE POLICY seller_items_insert_auth
ON api.seller_item_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM api.seller_profiles sp
    WHERE sp.id = seller_profile_id
      AND sp.user_id = api.current_user_id()
  )
);

DROP POLICY IF EXISTS seller_items_update_auth ON api.seller_item_submissions;
CREATE POLICY seller_items_update_auth
ON api.seller_item_submissions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM api.seller_profiles sp
    WHERE sp.id = seller_profile_id
      AND sp.user_id = api.current_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM api.seller_profiles sp
    WHERE sp.id = seller_profile_id
      AND sp.user_id = api.current_user_id()
  )
);

DROP POLICY IF EXISTS watchlist_insert_auth ON api.watchlists;
CREATE POLICY watchlist_insert_auth
ON api.watchlists
FOR INSERT
TO authenticated
WITH CHECK (lower(email) = api.current_user_email());

DROP POLICY IF EXISTS payment_orders_select_auth ON api.payment_orders;
CREATE POLICY payment_orders_select_auth
ON api.payment_orders
FOR SELECT
TO authenticated
USING (user_id = api.current_user_id());

DROP POLICY IF EXISTS payment_orders_insert_auth ON api.payment_orders;
CREATE POLICY payment_orders_insert_auth
ON api.payment_orders
FOR INSERT
TO authenticated
WITH CHECK (user_id = api.current_user_id());

DROP POLICY IF EXISTS payment_orders_update_auth ON api.payment_orders;
CREATE POLICY payment_orders_update_auth
ON api.payment_orders
FOR UPDATE
TO authenticated
USING (user_id = api.current_user_id())
WITH CHECK (user_id = api.current_user_id());

CREATE OR REPLACE FUNCTION api.place_bid_secure(p_lot_id uuid, p_amount numeric)
RETURNS api.lots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_user_id uuid;
  v_user api.site_users;
  v_lot api.lots;
  v_min_bid numeric;
BEGIN
  v_user_id := api.current_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_user
  FROM api.site_users
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

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

  INSERT INTO api.bids(lot_id, bidder_name, bidder_user_id, amount)
  VALUES (p_lot_id, v_user.full_name, v_user.id, p_amount);

  UPDATE api.lots
  SET current_bid = p_amount,
      bid_count = bid_count + 1
  WHERE id = p_lot_id
  RETURNING * INTO v_lot;

  RETURN v_lot;
END;
$$;

REVOKE EXECUTE ON FUNCTION api.place_bid(uuid, text, numeric) FROM web_anon;
REVOKE EXECUTE ON FUNCTION api.place_bid(uuid, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION api.place_bid_secure(uuid, numeric) TO authenticated;

GRANT USAGE ON SCHEMA api TO authenticated;
GRANT SELECT ON api.v_lot_feed TO authenticated;
GRANT SELECT ON api.auction_categories, api.sellers, api.auctions, api.lots, api.bids, api.watchlists TO authenticated;
GRANT INSERT ON api.watchlists TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api.seller_profiles, api.seller_item_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api.payment_orders TO authenticated;
GRANT EXECUTE ON FUNCTION api.server_now() TO web_anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
