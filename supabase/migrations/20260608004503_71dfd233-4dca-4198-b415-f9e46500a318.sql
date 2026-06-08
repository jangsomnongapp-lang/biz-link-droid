
REVOKE EXECUTE ON FUNCTION public.start_product_chat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_product_chat(uuid, uuid) TO authenticated;
