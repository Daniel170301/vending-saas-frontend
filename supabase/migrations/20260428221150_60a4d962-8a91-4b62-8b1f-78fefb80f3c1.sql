
-- Add new columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subcategory text;

-- Categories table (with optional parent for sub-categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own categories select" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own categories insert" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own categories update" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own categories delete" ON public.categories FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER categories_set_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "product images user upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product images user update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product images user delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
