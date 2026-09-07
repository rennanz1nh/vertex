-- Which days of the week (0=Sunday .. 6=Saturday) the daily cron is allowed to actually
-- run the price update on. Lets a "run 1x/day" cron support "2x/week" style schedules —
-- the cron still fires every day (Vercel Hobby limit), the handler just skips non-selected days.
ALTER TABLE public.ebay_price_automation
  ADD COLUMN IF NOT EXISTS active_weekdays INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6];
