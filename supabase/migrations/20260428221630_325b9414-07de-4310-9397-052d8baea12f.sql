
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS concept text,
  ALTER COLUMN machine_id DROP NOT NULL;
