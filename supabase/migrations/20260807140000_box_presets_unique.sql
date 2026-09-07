SET search_path TO vertex, extensions;

-- Prevent duplicate box presets at the DB level. The one-shot localStorage->DB migration
-- could run twice when two pages (Pedidos + Shipping) loaded at once, inserting every box
-- twice before either set the migrated flag. The client now guards with onlyIfEmpty, and
-- this unique index makes a concurrent double-seed impossible regardless.
CREATE UNIQUE INDEX IF NOT EXISTS box_presets_identity_uniq
  ON vertex.box_presets (name, length, width, height, distance_unit);
