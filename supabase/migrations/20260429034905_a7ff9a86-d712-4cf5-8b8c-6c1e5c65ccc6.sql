CREATE OR REPLACE FUNCTION public.set_transaction_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = 0 THEN
    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
    FROM public.transactions
    WHERE user_id = NEW.user_id AND kind = NEW.kind;
  END IF;
  RETURN NEW;
END; $$;