ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_company text;