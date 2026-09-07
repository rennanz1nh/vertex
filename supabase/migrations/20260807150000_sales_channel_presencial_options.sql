SET search_path TO vertex, extensions;

-- New non-marketplace payment channels shown in the order form's Canal de Venda dropdown.
-- "Presencial" and "Online" were removed from the UI; "Credit Card" was relabelled to
-- "Credit Card / Presencial" and a "Money / Presencial" option added. The old enum values
-- are kept (no data uses them, but dropping enum values is destructive and unnecessary).
ALTER TYPE sales_channel ADD VALUE IF NOT EXISTS 'Credit Card / Presencial';
ALTER TYPE sales_channel ADD VALUE IF NOT EXISTS 'Money / Presencial';
