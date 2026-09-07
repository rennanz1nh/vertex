-- product_id must become nullable: an eBay line item can arrive with no SKU set on the
-- listing, so there is no product to link yet. Previously this made the whole batch
-- insert for that order fail silently (NOT NULL violation), leaving affected eBay orders
-- with zero order_items at all.
alter table order_items alter column product_id drop not null;

-- Stable anchor (eBay's per-line lineItemId) so re-syncing an order can update quantity/
-- price in place instead of delete-and-reinsert, which used to wipe out a manually
-- assigned product_id on every sync run.
alter table order_items add column if not exists ebay_line_item_id text;
