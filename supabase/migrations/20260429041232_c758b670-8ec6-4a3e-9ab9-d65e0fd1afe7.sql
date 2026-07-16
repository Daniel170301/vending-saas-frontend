
-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  doc_type TEXT,
  doc_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers select" ON public.customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own customers insert" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own customers update" ON public.customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own customers delete" ON public.customers FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  doc_type TEXT,
  doc_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suppliers select" ON public.suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own suppliers insert" ON public.suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own suppliers update" ON public.suppliers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own suppliers delete" ON public.suppliers FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Machine layout (bandejas/resortes) — JSON estructura visual
ALTER TABLE public.machines
  ADD COLUMN layout JSONB;
COMMENT ON COLUMN public.machines.layout IS 'Estructura visual: { trays: [{ id, label, springs: [{ id, label, capacity }] }] }';
