SET search_path TO vertex, extensions;

-- One row per Turo guest (Turo renter id), rebuilt on every Turo sync from turo_trips,
-- turo_receipts and the reviews guests left (see src/lib/turo-guests.ts). Turo never
-- shares a guest's email, phone or address with hosts; the our_* columns are ours to fill
-- in and are never overwritten by the sync.
CREATE TABLE IF NOT EXISTS vertex.turo_guests (
  renter_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  profile_url TEXT,
  image_url TEXT,               -- Turo's CDN
  photo_path TEXT,              -- our copy in storage bucket vertex-turo-guest-photos
  photo_source_url TEXT,        -- which Turo image the copy was made from
  photo_verified BOOLEAN,
  trips_count INTEGER NOT NULL DEFAULT 0,
  cancelled_count INTEGER NOT NULL DEFAULT 0,
  upcoming_count INTEGER NOT NULL DEFAULT 0,
  first_trip_at TIMESTAMP WITH TIME ZONE,
  last_trip_at TIMESTAMP WITH TIME ZONE,
  total_days INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(10, 2) NOT NULL DEFAULT 0,      -- what the guest paid (receipts)
  host_earned NUMERIC(10, 2) NOT NULL DEFAULT 0,      -- what we received
  reimbursements NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- tolls, fuel, cleaning... billed to them
  miles_driven INTEGER,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3, 2),                           -- stars they gave us
  last_review_text TEXT,
  last_review_at TIMESTAMP WITH TIME ZONE,
  cars TEXT[] NOT NULL DEFAULT '{}',
  trips JSONB NOT NULL DEFAULT '[]'::jsonb,           -- summary of each trip, newest first
  reviews JSONB NOT NULL DEFAULT '[]'::jsonb,         -- reviews they left us
  profile_data JSONB,                                 -- raw public Turo profile, when the sync can fetch it
  profile_synced_at TIMESTAMP WITH TIME ZONE,
  our_phone TEXT,
  our_email TEXT,
  our_notes TEXT,
  our_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turo_guests_last_trip ON vertex.turo_guests (last_trip_at DESC);

ALTER TABLE vertex.turo_guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admin can manage turo_guests" ON vertex.turo_guests;
CREATE POLICY "Only admin can manage turo_guests"
  ON vertex.turo_guests FOR ALL
  USING (vertex.get_current_user_role() = 'admin'::vertex.app_role)
  WITH CHECK (vertex.get_current_user_role() = 'admin'::vertex.app_role);

-- Guest profile photos (already public on Turo); written only by the server (service role).
INSERT INTO storage.buckets (id, name, public)
VALUES ('vertex-turo-guest-photos', 'vertex-turo-guest-photos', true)
ON CONFLICT (id) DO NOTHING;
