DROP INDEX IF EXISTS public.idx_supplier_catalog_items_store_product;
DROP INDEX IF EXISTS public.supplier_catalog_items_store_product_key;

CREATE UNIQUE INDEX supplier_catalog_items_store_product_key
  ON public.supplier_catalog_items (store_id, product_id);