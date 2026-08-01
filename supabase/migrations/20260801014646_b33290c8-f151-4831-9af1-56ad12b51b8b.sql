ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS market_price_min numeric,
  ADD COLUMN IF NOT EXISTS market_price_max numeric,
  ADD COLUMN IF NOT EXISTS market_currency text NOT NULL DEFAULT 'USD';

ALTER TABLE public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'in_stock';

CREATE OR REPLACE FUNCTION public.validate_catalog_stock_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_status NOT IN ('in_stock', 'low', 'out') THEN
    RAISE EXCEPTION 'invalid stock_status: %', NEW.stock_status;
  END IF;
  NEW.in_stock := NEW.stock_status <> 'out';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_catalog_stock_status ON public.supplier_catalog_items;
CREATE TRIGGER validate_catalog_stock_status
  BEFORE INSERT OR UPDATE ON public.supplier_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_catalog_stock_status();

UPDATE public.supplier_catalog_items
   SET stock_status = CASE WHEN in_stock THEN 'in_stock' ELSE 'out' END;

WITH bands(code, lo, hi) AS (
  VALUES
    ('cement', 6.00, 9.50),
    ('steel', 8.00, 22.00),
    ('bricks', 0.25, 1.60),
    ('tiles', 5.50, 14.00),
    ('paint', 12.00, 45.00),
    ('plumbing', 1.20, 18.00),
    ('electrical', 1.50, 30.00),
    ('roofing', 6.50, 16.00),
    ('wood', 9.00, 26.00),
    ('glass_aluminum', 12.00, 38.00),
    ('doors_windows', 15.00, 90.00),
    ('sanitary', 18.00, 120.00),
    ('hardware', 3.00, 60.00),
    ('machinery', 60.00, 450.00)
)
UPDATE public.catalog_products p
   SET market_price_min = b.lo,
       market_price_max = b.hi,
       market_currency = 'USD'
  FROM public.supplier_categories c, bands b
 WHERE c.id = p.category_id
   AND c.code = b.code
   AND p.market_price_min IS NULL;