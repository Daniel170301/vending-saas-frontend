-- 1) EMPLOYEES
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own employees select" ON public.employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own employees insert" ON public.employees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own employees update" ON public.employees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own employees delete" ON public.employees FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  number INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sale', -- 'sale' | 'expense'
  concept TEXT,
  customer TEXT,
  payment_method TEXT,
  employee_id UUID,
  employee_name TEXT,
  notes TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own transactions select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own transactions insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transactions update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own transactions delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, occurred_at DESC);
CREATE UNIQUE INDEX idx_transactions_user_number_kind ON public.transactions(user_id, kind, number);

-- 3) Auto-numeración por usuario y tipo
CREATE OR REPLACE FUNCTION public.set_transaction_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = 0 THEN
    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
    FROM public.transactions
    WHERE user_id = NEW.user_id AND kind = NEW.kind;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_transactions_number BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_transaction_number();

-- 4) Vincular ventas y compras a la transacción
ALTER TABLE public.sales ADD COLUMN transaction_id UUID;
ALTER TABLE public.purchases ADD COLUMN transaction_id UUID;
CREATE INDEX idx_sales_transaction ON public.sales(transaction_id);
CREATE INDEX idx_purchases_transaction ON public.purchases(transaction_id);