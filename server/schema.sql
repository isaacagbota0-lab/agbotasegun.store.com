-- ═══════════════════════════════════════════════════════════════════════════
-- Agbota Segun — database schema
-- PostgreSQL. Idempotent: safe to run on every boot.
--
-- Security model:
--   Every authenticated request runs inside a transaction that sets two
--   session variables: app.user_id and app.user_role. Row Level Security is
--   ENABLED and FORCED on every application table, so a query can only ever
--   see or modify rows the current user is allowed to touch — even if a
--   future code path forgets to scope a WHERE clause.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles (users + roles) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'streamer' CHECK (role IN ('streamer', 'owner')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_ci ON profiles (lower(email));

-- ── Products (catalog) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
  category     TEXT NOT NULL CHECK (category IN ('single', 'bundle', 'custom')),
  platforms    JSONB NOT NULL DEFAULT '[]'::jsonb,
  tagline      TEXT NOT NULL,
  description  TEXT NOT NULL,
  includes     JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience     JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Conversations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_participants_profile ON conversation_participants (profile_id);

-- ── Messages ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_type    TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'document', 'voice')),
  content         TEXT CHECK (content IS NULL OR char_length(content) <= 4000),
  attachment_url  TEXT,
  attachment_name TEXT,
  attachment_size BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);

-- ── Orders ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  order_number    TEXT NOT NULL UNIQUE,
  streamer_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES products(id),
  price_cents     INTEGER NOT NULL,
  payment_status  TEXT NOT NULL DEFAULT 'awaiting'
                  CHECK (payment_status IN ('awaiting', 'review', 'confirmed', 'cancelled')),
  order_status    TEXT NOT NULL DEFAULT 'awaiting_payment'
                  CHECK (order_status IN ('awaiting_payment', 'payment_review', 'confirmed',
                                          'in_progress', 'delivered', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_streamer ON orders (streamer_id, created_at DESC);

-- ── Payments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  streamer_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  method        TEXT NOT NULL CHECK (method IN ('btc', 'paypal', 'other')),
  reference     TEXT,
  receipt_url   TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at  TIMESTAMPTZ,
  admin_note    TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);

-- ── Reviews ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  streamer_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1200),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status, created_at DESC);

-- ── Proof of work items (admin-managed, real screenshots only) ─────────────
CREATE TABLE IF NOT EXISTS proof_items (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  category    TEXT NOT NULL CHECK (category IN ('conversations', 'strategy', 'analysis', 'progress', 'feedback', 'payouts')),
  platform    TEXT CHECK (platform IS NULL OR char_length(platform) <= 60),
  caption     TEXT CHECK (caption IS NULL OR char_length(caption) <= 500),
  item_date   TEXT CHECK (item_date IS NULL OR char_length(item_date) <= 40),
  image_url   TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  published   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proof_published ON proof_items (published, sort_order, created_at DESC);

-- ── Notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('streamer_signup', 'new_order', 'new_message',
                                           'payment_review', 'payment_confirmed',
                                           'order_update', 'review_moderated')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, read_at, created_at DESC);

-- ── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_conversations_updated ON conversations;
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_proof_updated ON proof_items;
CREATE TRIGGER trg_proof_updated BEFORE UPDATE ON proof_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                  FORCE ROW LEVEL SECURITY;
ALTER TABLE products                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                  FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations             FORCE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  FORCE ROW LEVEL SECURITY;
ALTER TABLE orders                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                    FORCE ROW LEVEL SECURITY;
ALTER TABLE payments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                  FORCE ROW LEVEL SECURITY;
ALTER TABLE reviews                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                   FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications             FORCE ROW LEVEL SECURITY;
ALTER TABLE proof_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_items               FORCE ROW LEVEL SECURITY;

-- ── Auth entry points (bypass RLS on purpose; gated by application code) ──
CREATE OR REPLACE FUNCTION app_get_profile_by_id(uid TEXT)
RETURNS SETOF profiles LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT * FROM profiles WHERE id = uid LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION app_get_profile_by_email(em TEXT)
RETURNS SETOF profiles LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT * FROM profiles WHERE lower(email) = lower(em) LIMIT 1;
$$;

-- Conversation partner lookup: participants can read the display info of the
-- person on the other side of a conversation they belong to.
CREATE OR REPLACE FUNCTION app_get_conversation_partner(cid TEXT, me TEXT)
RETURNS TABLE (id TEXT, name TEXT, email TEXT, role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.name, p.email, p.role
  FROM conversation_participants cp
  JOIN profiles p ON p.id = cp.profile_id
  WHERE cp.conversation_id = cid AND cp.profile_id <> me
  LIMIT 1;
$$;

-- Helpers used inside policies
CREATE OR REPLACE FUNCTION app_uid() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::text;
$$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION app_is_owner() RETURNS BOOLEAN AS $$
  SELECT current_setting('app.user_role', true) = 'owner';
$$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION is_participant(cid TEXT, uid TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM conversation_participants cp
                 WHERE cp.conversation_id = cid AND cp.profile_id = uid);
$$ LANGUAGE sql STABLE SECURITY DEFINER;
CREATE OR REPLACE FUNCTION is_participant_any(uid TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.profile_id = uid);
$$ LANGUAGE sql STABLE;

-- profiles: users see themselves; the owner sees everyone (contact list)
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (app_is_owner() OR id = app_uid());
DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (id = app_uid());
DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = app_uid())
  WITH CHECK (id = app_uid());

-- A user may never change their own role — only the owner (via a future
-- server-side tool) may, and the app exposes no such endpoint.
CREATE OR REPLACE FUNCTION protect_role() RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'changing roles is not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_profiles_role ON profiles;
CREATE TRIGGER trg_profiles_role BEFORE UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_role();

-- products: public read; only the owner modifies
DROP POLICY IF EXISTS products_select ON products;
CREATE POLICY products_select ON products FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS products_admin ON products;
CREATE POLICY products_admin ON products FOR ALL
  USING (app_is_owner()) WITH CHECK (app_is_owner());

-- conversations: participants or the owner
DROP POLICY IF EXISTS conversations_select ON conversations;
CREATE POLICY conversations_select ON conversations FOR SELECT
  USING (app_is_owner() OR is_participant(id, app_uid()));
DROP POLICY IF EXISTS conversations_insert ON conversations;
CREATE POLICY conversations_insert ON conversations FOR INSERT
  WITH CHECK (TRUE);
DROP POLICY IF EXISTS conversations_update ON conversations;
CREATE POLICY conversations_update ON conversations FOR UPDATE
  USING (app_is_owner() OR is_participant(id, app_uid()));

-- participants: yourself, or the owner managing the contact list
DROP POLICY IF EXISTS participants_select ON conversation_participants;
CREATE POLICY participants_select ON conversation_participants FOR SELECT
  USING (app_is_owner() OR profile_id = app_uid());
DROP POLICY IF EXISTS participants_insert ON conversation_participants;
CREATE POLICY participants_insert ON conversation_participants FOR INSERT
  WITH CHECK (app_is_owner() OR profile_id = app_uid());
DROP POLICY IF EXISTS participants_delete ON conversation_participants;
CREATE POLICY participants_delete ON conversation_participants FOR DELETE
  USING (app_is_owner() OR profile_id = app_uid());

-- messages: participants or the owner; recipients may update read_at
DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages FOR SELECT
  USING (app_is_owner() OR is_participant(conversation_id, app_uid()));
DROP POLICY IF EXISTS messages_insert ON messages;
CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (is_participant(conversation_id, app_uid()) OR app_is_owner());
DROP POLICY IF EXISTS messages_update ON messages;
CREATE POLICY messages_update ON messages FOR UPDATE
  USING (is_participant(conversation_id, app_uid()) OR app_is_owner());

-- orders: streamer owns their orders; owner sees all
DROP POLICY IF EXISTS orders_select ON orders;
CREATE POLICY orders_select ON orders FOR SELECT
  USING (app_is_owner() OR streamer_id = app_uid());
DROP POLICY IF EXISTS orders_insert ON orders;
CREATE POLICY orders_insert ON orders FOR INSERT
  WITH CHECK (streamer_id = app_uid());
DROP POLICY IF EXISTS orders_update ON orders;
CREATE POLICY orders_update ON orders FOR UPDATE
  USING (app_is_owner() OR streamer_id = app_uid());

-- payments: streamer owns theirs; owner sees all
DROP POLICY IF EXISTS payments_select ON payments;
CREATE POLICY payments_select ON payments FOR SELECT
  USING (app_is_owner() OR streamer_id = app_uid());
DROP POLICY IF EXISTS payments_insert ON payments;
CREATE POLICY payments_insert ON payments FOR INSERT
  WITH CHECK (streamer_id = app_uid());
DROP POLICY IF EXISTS payments_update ON payments;
CREATE POLICY payments_update ON payments FOR UPDATE
  USING (app_is_owner() OR streamer_id = app_uid());

-- reviews: public once approved; streamer manages own; owner moderates
DROP POLICY IF EXISTS reviews_select ON reviews;
CREATE POLICY reviews_select ON reviews FOR SELECT
  USING (status = 'approved' OR streamer_id = app_uid() OR app_is_owner());
DROP POLICY IF EXISTS reviews_insert ON reviews;
CREATE POLICY reviews_insert ON reviews FOR INSERT
  WITH CHECK (streamer_id = app_uid());
DROP POLICY IF EXISTS reviews_update ON reviews;
CREATE POLICY reviews_update ON reviews FOR UPDATE
  USING (streamer_id = app_uid() OR app_is_owner());
DROP POLICY IF EXISTS reviews_delete ON reviews;
CREATE POLICY reviews_delete ON reviews FOR DELETE
  USING (app_is_owner());

-- notifications: only the owning user
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (user_id = app_uid());
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (user_id = app_uid());

-- proof_items: published items are public; the owner manages everything
DROP POLICY IF EXISTS proof_select ON proof_items;
CREATE POLICY proof_select ON proof_items FOR SELECT
  USING (published = TRUE OR app_is_owner());
DROP POLICY IF EXISTS proof_admin ON proof_items;
CREATE POLICY proof_admin ON proof_items FOR ALL
  USING (app_is_owner()) WITH CHECK (app_is_owner());
