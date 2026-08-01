CREATE UNIQUE INDEX IF NOT EXISTS supplier_catalog_items_store_product_key
  ON public.supplier_catalog_items (store_id, product_id)
  WHERE product_id IS NOT NULL;