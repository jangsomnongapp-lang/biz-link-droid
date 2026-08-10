DELETE FROM public.supplier_catalog_items a
USING public.supplier_catalog_items b
WHERE a.product_id IS NOT NULL
  AND a.store_id = b.store_id
  AND a.product_id = b.product_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_catalog_items_store_product_key
  ON public.supplier_catalog_items (store_id, product_id);