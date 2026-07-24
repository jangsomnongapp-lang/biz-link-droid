import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, MessageCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ShareButton } from "@/components/ShareButton";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/price";
import { getPublicPost, type PublicPostDetail } from "@/lib/posts.functions";
import { useState } from "react";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params }) => await getPublicPost({ data: { id: params.postId } }),
  head: ({ loaderData, params }) => {
    const post = loaderData as PublicPostDetail | null;
    const url = `https://buildhubkh.com/posts/${params.postId}`;
    if (!post) {
      return {
        meta: [
          { title: "Product — BuildHub" },
          { name: "description", content: "Product details on BuildHub." },
          { property: "og:url", content: url },
          { property: "og:type", content: "product" },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const heading =
      post.title || post.content?.split("\n")[0] || "Product";
    const desc =
      (post.content ?? "").slice(0, 160) ||
      `${heading} on BuildHub — Cambodia's construction marketplace.`;
    const image = post.post_photos[0]?.photo_url;
    const title = `${heading} — BuildHub`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "product" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
              { name: "twitter:card", content: "summary_large_image" },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: heading,
            description: desc,
            image: image ? [image] : undefined,
            url,
            offers:
              post.price != null
                ? {
                    "@type": "Offer",
                    price: post.discount_price ?? post.price,
                    priceCurrency: post.currency || "USD",
                    availability: "https://schema.org/InStock",
                    url,
                  }
                : undefined,
          }),
        },
      ],
    };
  },
  component: PostDetailPage,
});

function PostDetailPage() {
  const { postId } = Route.useParams();
  const initial = Route.useLoaderData() as PublicPostDetail | null;
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const post = initial;
  const store = initial?.store ?? null;
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    if (post && user && user.id !== post.user_id) {
      void supabase
        .from("posts")
        .update({ view_count: (post.view_count ?? 0) + 1 })
        .eq("id", post.id);
    }
  }, [post, user]);

  async function startConversation() {
    if (!post) return;
    if (!user) {
      nav({ to: "/login" });
      return;
    }
    if (user.id === post.user_id) return;
    setContacting(true);
    try {
      const { data: threadId, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: string | null; error: { message: string } | null }>
      )("start_product_chat", { _supplier_id: post.user_id, _post_id: post.id });
      if (error) throw error;
      const heading =
        post.title || post.content?.split("\n")[0] || (lang === "km" ? "ទំនិញ" : "Product");
      const priceText =
        post.discount_price != null
          ? formatPrice(post.discount_price, post.currency)
          : post.price != null
            ? formatPrice(post.price, post.currency)
            : null;
      const prefill =
        lang === "km"
          ? `សួស្តី ខ្ញុំចង់សួរព័ត៌មានអំពី ${heading}${priceText ? ` — ${priceText}` : ""}`
          : `Hi, I'd like to ask about ${heading}${priceText ? ` — ${priceText}` : ""}`;
      nav({
        to: "/messages/$threadId",
        params: { threadId: threadId as string },
        search: { pin: `post:${post.id}`, prefill },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContacting(false);
    }
  }

  if (!post) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {lang === "km" ? "រកមិនឃើញទំនិញ" : "Product not found"}
      </div>
    );
  }

  const isOwner = user?.id === post.user_id;
  const meta = POST_TYPE_LABELS[post.post_type as keyof typeof POST_TYPE_LABELS];
  const heading = post.title || post.content?.split("\n")[0] || (lang === "km" ? "ទំនិញ" : "Product");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <button onClick={() => nav({ to: ".." })} className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "ព័ត៌មានលម្អិត" : "Product Details"}
        </h1>
        <ShareButton
          path={`/posts/${postId}`}
          title={heading}
          className="rounded-full p-2 active:bg-white/10"
        />
      </header>

      <div className="flex-1 space-y-2 pb-24">
        {/* Photos */}
        {post.post_photos.length > 0 && (
          <div className="bg-surface">
            <div className="no-scrollbar flex gap-0 overflow-x-auto snap-x snap-mandatory">
              {post.post_photos.map((p, i) => (
                <div key={i} className="aspect-square w-full shrink-0 snap-start bg-muted">
                  <img src={p.photo_url} alt={heading} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-surface p-4 shadow-card">
          {meta && (
            <span className={`inline-block rounded-pill px-2.5 py-1 text-xs font-bold ${meta.bg} ${meta.fg}`}>
              {lang === "km" ? meta.km : meta.en}
            </span>
          )}
          <h2 className="mt-2 text-lg font-bold text-foreground">{heading}</h2>
          {post.content && post.content !== heading && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.content}</p>
          )}
          <div className="mt-3 flex items-baseline gap-2">
            {post.discount_price != null ? (
              <>
                <span className="text-xl font-bold text-rose-600">
                  {formatPrice(post.discount_price, post.currency)}
                </span>
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(post.price, post.currency)}
                </span>
              </>
            ) : post.price != null ? (
              <span className="text-xl font-bold text-success">{formatPrice(post.price, post.currency)}</span>
            ) : null}
          </div>
        </div>

        {/* Store info */}
        {store && (
          <Link
            to="/suppliers/$storeId"
            params={{ storeId: store.id }}
            className="flex items-center gap-3 bg-surface p-4 shadow-card active:opacity-70"
          >
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-sm font-bold text-foreground">
                {store.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">{store.name}</div>
              <div className="text-xs text-muted-foreground">
                {lang === "km" ? "មើលហាង" : "View store"}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        )}

        {!user && (
          <div className="mx-4 mt-4 rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {lang === "km"
                ? "ចូលដើម្បីជជែក បញ្ចេញមតិ ឬចូលចិត្ត"
                : "Sign in to chat, comment or like"}
            </p>
            <Link
              to="/login"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {lang === "km" ? "ចូល" : "Sign in"}
            </Link>
          </div>
        )}
      </div>

      {/* Contact button */}
      {!isOwner && user && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] border-t border-border bg-surface px-5 py-3">
          <button
            onClick={() => void startConversation()}
            disabled={contacting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" />
            {lang === "km" ? "សួរឥឡូវ" : "Ask now"}
          </button>
        </div>
      )}
    </div>
  );
}

const POST_TYPE_LABELS: Record<string, { en: string; km: string; bg: string; fg: string }> = {
  novedad:     { en: "New",       km: "ថ្មី",        bg: "bg-emerald-100", fg: "text-emerald-700" },
  stock:       { en: "Stock",     km: "ស្តុក",       bg: "bg-sky-100",     fg: "text-sky-700" },
  oferta:      { en: "Offer",     km: "ការផ្តល់ជូន",  bg: "bg-amber-100",   fg: "text-amber-700" },
  liquidacion: { en: "Clearance", km: "បោះតម្លៃ",    bg: "bg-rose-100",    fg: "text-rose-700" },
};
