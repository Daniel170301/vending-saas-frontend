-- Add brand/model/plate columns + monedero/billetero info to machines
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS plate text,
  ADD COLUMN IF NOT EXISTS coin_brand text,
  ADD COLUMN IF NOT EXISTS coin_plate text,
  ADD COLUMN IF NOT EXISTS bill_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bill_brand text,
  ADD COLUMN IF NOT EXISTS bill_model text,
  ADD COLUMN IF NOT EXISTS bill_plate text;

-- Company profile (one per user)
CREATE TABLE IF NOT EXISTS public.company_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  business_name text NOT NULL,
  legal_name text,
  doc_type text,
  doc_number text,
  address text,
  phone text,
  email text,
  currency text NOT NULL DEFAULT 'PEN',
  business_type text NOT NULL DEFAULT 'vending_machine',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own company select" ON public.company_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own company insert" ON public.company_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own company update" ON public.company_profile FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own company delete" ON public.company_profile FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER company_profile_set_updated_at
BEFORE UPDATE ON public.company_profile
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();