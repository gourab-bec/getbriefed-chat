-- Clinkit schema (Postgres 16 + PostGIS). Money in integer cents.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role          text NOT NULL CHECK (role IN ('buyer','runner','store','admin')),
  email         text UNIQUE NOT NULL,
  phone         text,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  home_zip      text,
  home_point    geography(Point, 4326),
  consent_log   jsonb NOT NULL DEFAULT '[]',
  deleted_at    timestamptz,             -- CCPA soft delete; purge job after 30d
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE runner_profiles (
  user_id            uuid PRIMARY KEY REFERENCES users(id),
  stripe_account_id  text,               -- Connect Express
  background_check   text NOT NULL DEFAULT 'pending' CHECK (background_check IN ('pending','clear','failed')),
  w9_status          text NOT NULL DEFAULT 'pending',
  vehicle            text,
  rating             numeric(3,2) NOT NULL DEFAULT 5.00,
  completed_orders   int NOT NULL DEFAULT 0,
  online             boolean NOT NULL DEFAULT false,
  last_point         geography(Point, 4326),
  last_seen_at       timestamptz
);

CREATE TABLE stores (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain    text NOT NULL,                -- winco|walmart|kroger|target|safeway|local
  name     text NOT NULL,
  source   text NOT NULL,                -- kroger_api|walmart_api|instacart|briskly|google_places
  external_id text,
  zip      text NOT NULL,
  address  text,
  point    geography(Point, 4326) NOT NULL,
  deals    jsonb NOT NULL DEFAULT '[]',  -- optional store-published deals
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX stores_point_gix ON stores USING GIST (point);

CREATE TABLE store_offers (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id         uuid NOT NULL REFERENCES stores(id),
  item_query       text NOT NULL,        -- normalized
  item_name        text NOT NULL,
  unit             text,
  base_price_cents int NOT NULL CHECK (base_price_cents >= 0),
  in_stock         boolean NOT NULL DEFAULT true,
  provider         text NOT NULL,
  confidence       numeric(3,2) NOT NULL DEFAULT 0.8,
  fetched_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_offers_lookup ON store_offers (item_query, fetched_at DESC);

CREATE TABLE quotes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id   uuid REFERENCES users(id),
  zip        text NOT NULL,
  items      jsonb NOT NULL,             -- ["milk","eggs",...]
  options    jsonb NOT NULL,             -- ranked StoreOption[] snapshot
  surge      numeric(3,1) NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id         uuid NOT NULL REFERENCES users(id),
  quote_id         uuid REFERENCES quotes(id),
  store_chain      text NOT NULL,
  store_name       text NOT NULL,
  store_point      geography(Point, 4326),
  dropoff_point    geography(Point, 4326) NOT NULL,
  dropoff_address  text NOT NULL,
  status           text NOT NULL DEFAULT 'requested' CHECK (status IN
    ('draft','quoted','requested','bidding','matched','shopping','purchased','enroute','delivered','completed','cancelled','disputed')),
  runner_id        uuid REFERENCES users(id),
  surge_multiplier numeric(3,1) NOT NULL DEFAULT 1.0,
  totals           jsonb NOT NULL,       -- computeTotals() snapshot; actuals overwrite at purchase
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_status_idx ON orders (status, created_at DESC);

CREATE TABLE order_items (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_query       text NOT NULL,
  item_name        text NOT NULL,
  est_price_cents  int NOT NULL,
  actual_price_cents int,                -- from receipt at purchase
  fulfillment      text NOT NULL DEFAULT 'pending' CHECK (fulfillment IN ('pending','found','substituted','out_of_stock')),
  substitution_note text
);

CREATE TABLE bids (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  runner_id   uuid NOT NULL REFERENCES users(id),
  markup_pct  numeric(4,1) NOT NULL CHECK (markup_pct BETWEEN 5 AND 20),
  eta_min     int NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','expired','withdrawn')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  UNIQUE (order_id, runner_id)
);

CREATE TABLE deliveries (
  order_id          uuid PRIMARY KEY REFERENCES orders(id),
  receipt_photo_s3  text,
  delivery_photo_s3 text,
  gps_trail         jsonb NOT NULL DEFAULT '[]',  -- purged 30d post-delivery
  purchased_at      timestamptz,
  delivered_at      timestamptz
);

CREATE TABLE payments (
  order_id           uuid PRIMARY KEY REFERENCES orders(id),
  stripe_pi_id       text NOT NULL,
  stripe_transfer_id text,
  amount_cents       int NOT NULL,
  platform_fee_cents int NOT NULL,
  runner_payout_cents int NOT NULL,
  status             text NOT NULL DEFAULT 'authorized' CHECK (status IN ('authorized','captured','refunded','partially_refunded','voided','failed')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES users(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ratings (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   uuid NOT NULL REFERENCES orders(id),
  rater_id   uuid NOT NULL REFERENCES users(id),
  ratee_id   uuid NOT NULL REFERENCES users(id),
  stars      int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, rater_id)
);

CREATE TABLE disputes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   uuid NOT NULL REFERENCES orders(id),
  opened_by  uuid NOT NULL REFERENCES users(id),
  reason     text NOT NULL,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','refunded','partial_refund','denied','resolved')),
  resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payouts (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  runner_id   uuid NOT NULL REFERENCES users(id),
  order_id    uuid REFERENCES orders(id),
  amount_cents int NOT NULL,
  stripe_transfer_id text,
  tax_year    int NOT NULL,              -- 1099 export bucket
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid,
  action     text NOT NULL,
  target     text,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
