-- Restrict phone column reads to elevated contexts (owner/admin via RPC, service_role for server fns).
-- Authenticated users can no longer SELECT phone directly via PostgREST.
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (phone) ON public.supplier_stores FROM anon, authenticated;

-- Service role keeps full access (used by server functions / admin RPCs).
GRANT SELECT (phone) ON public.profiles TO service_role;
GRANT SELECT (phone) ON public.supplier_stores TO service_role;