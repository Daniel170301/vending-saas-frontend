ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.machines REPLICA IDENTITY FULL;