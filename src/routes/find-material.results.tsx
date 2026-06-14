import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, PackageSearch, Store } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/price";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/find-material/results")({
  validateSearch: (params: Record<string, unknown>): { q?: string } => ({
    q: typeof params.q === "string" ? params.q.slice(0, 200) : undefined,
  }),
  component: () => (
    <RequireAuth>
      <ScanResultsPage />
    </RequireAuth>
  ),
});

interface ProductResult {
  id: string;
  title: string | null;
  content: string | null;
  price: number | null;
  discount_price: number | null;
  currency: string;
  user_id: string;
  photo_url: string | null;
  store_id: string | null;
  store_name: string | null;
}

function ScanResultsPage() {
  const { q = "" } = Route.useSearch();
  const { lang } = useI18n();
  const [loading, setLoading] = useState(Boolean(q));
  const [products, setProducts] = useState<ProductResult[]>([]);

  useEffect(() => {
    if (!q.trim()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const terms = Array.from(
        new Set(
          q
            .replace(/[^\p{L}\p{N}\s-]/gu, " ")
            .split(/\s+/)
            .map((term) => term.trim())
            .filter((term) => term.length >= 2),
        ),
      ).slice(0, 6);
      const filters = [q.trim(), ...terms]
        .map((term) => term.replace(/[,%()]/g, " ").trim())
        .filter(Boolean)
        .flatMap((term) => [`title.ilike.%${term}%`, `content.ilike.%${term}%`]);
      if (!filters.length) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("posts")
        .select(
          "id, title, content, price, discount_price, currency, user_id, post_photos(photo_url)",
        )
        .eq("status", "approved")
        .in("post_type", ["novedad", "stock", "oferta", "liquidacion"])
        .or(filters.join(","))
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      const rows = data ?? [];
      const ownerIds = Array.from(new Set(rows.map((post) => post.user_id)));
      const { data: stores } = ownerIds.length
        ? await supabase
            .from("supplier_stores")
            .select("id, user_id, name")
            .eq("status", "approved")
            .in("user_id", ownerIds)
        : { data: [] };
      if (cancelled) return;
      const storesByOwner = new Map((stores ?? []).map((store) => [store.user_id, store]));
      setProducts(
        rows.map((post) => {
          const store = storesByOwner.get(post.user_id);
          return {
            ...post,
            photo_url: post.post_photos?.[0]?.photo_url ?? null,
            store_id: store?.id ?? null,
            store_name: store?.name ?? null,
          };
        }),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-3 text-primary-foreground">
        <Link to="/find-material" className="rounded-full p-2 active:bg-primary-foreground/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "លទ្ធផលស្វែងរក" : "Picture search results"}
        </h1>
        <span className="w-9" />
      </header>

      {loading ? (
        <div className="space-y-3 p-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <main className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <PackageSearch className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">
            {lang === "km" ? "រកមិនឃើញផលិតផល" : "Product not found"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {q
              ? lang === "km"
                ? `មិនមានប្រកាសពីអ្នកផ្គត់ផ្គង់ដែលត្រូវនឹង “${q}” ទេ។`
                : `No supplier posts matched “${q}”.`
              : lang === "km"
                ? "យើងមិនអាចស្គាល់ផលិតផលក្នុងរូបភាពនេះបានទេ។"
                : "We could not identify a product in this picture."}
          </p>
          <Link
            to="/find-material"
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            {lang === "km" ? "សាកល្បងរូបភាពផ្សេង" : "Try another picture"}
          </Link>
        </main>
      ) : (
        <main className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            {lang === "km" ? `រកឃើញ ${products.length} លទ្ធផលសម្រាប់ “${q}”` : `${products.length} results for “${q}”`}
          </p>
          {products.map((product) => (
            <article key={product.id} className="flex gap-3 rounded-2xl bg-surface p-3 shadow-card">
              {product.photo_url ? (
                <img
                  src={product.photo_url}
                  alt={product.title ?? "Product"}
                  className="h-24 w-24 shrink-0 rounded-xl bg-muted object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <PackageSearch className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 text-sm font-bold text-foreground">
                  {product.title || product.content?.split("\n")[0] || "Product"}
                </h2>
                {product.discount_price != null || product.price != null ? (
                  <p className="mt-1 text-base font-bold text-primary">
                    {formatPrice(product.discount_price ?? product.price ?? 0, product.currency)}
                  </p>
                ) : null}
                {product.store_id ? (
                  <Link
                    to="/suppliers/$storeId"
                    params={{ storeId: product.store_id }}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                  >
                    <Store className="h-3.5 w-3.5" />
                    {product.store_name ?? (lang === "km" ? "មើលហាង" : "View supplier")}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </main>
      )}
    </div>
  );
}