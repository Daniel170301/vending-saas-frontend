CREATE TABLE public.vending_consumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  machine_id UUID NOT NULL,
  slot_code TEXT,
  product_id UUID,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_id UUID,
  customer_name TEXT,
  notes TEXT,
  consumed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sale_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vending_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own vc select" ON public.vending_consumptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own vc insert" ON public.vending_consumptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own vc update" ON public.vending_consumptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own vc delete" ON public.vending_consumptions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER vc_set_updated_at BEFORE UPDATE ON public.vending_consumptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_vc_user_status ON public.vending_consumptions(user_id, status);
CREATE INDEX idx_vc_machine ON public.vending_consumptions(machine_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.vending_consumptions;
ALTER TABLE public.vending_consumptions REPLICA IDENTITY FULL;