
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- MACHINES
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  location TEXT,
  coin_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  coin_current NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own machines select" ON public.machines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own machines insert" ON public.machines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own machines update" ON public.machines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own machines delete" ON public.machines FOR DELETE USING (auth.uid() = user_id);

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_warehouse INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products select" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own products insert" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own products update" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own products delete" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- PURCHASES
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  supplier TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases select" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own purchases insert" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own purchases update" ON public.purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own purchases delete" ON public.purchases FOR DELETE USING (auth.uid() = user_id);

-- MACHINE STOCK
CREATE TABLE public.machine_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  slot_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (machine_id, product_id)
);
ALTER TABLE public.machine_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ms select" ON public.machine_stock FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own ms insert" ON public.machine_stock FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ms update" ON public.machine_stock FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own ms delete" ON public.machine_stock FOR DELETE USING (auth.uid() = user_id);

-- SALES
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales select" ON public.sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sales insert" ON public.sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sales update" ON public.sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sales delete" ON public.sales FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX sales_user_sold_at_idx ON public.sales(user_id, sold_at DESC);

-- DEVICES
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  label TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices select" ON public.devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own devices insert" ON public.devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own devices update" ON public.devices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own devices delete" ON public.devices FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_machines_upd BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_upd BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ms_upd BEFORE UPDATE ON public.machine_stock FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
