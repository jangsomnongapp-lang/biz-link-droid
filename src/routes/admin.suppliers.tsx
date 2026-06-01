import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Check, Plus, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/suppliers")({
  component: () => (
    <RequireAdmin>
      <AdminSuppliersPage />
    </RequireAdmin>
  ),
});

interface Invite {
  id: string;
  token: string;
  note: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

interface PendingStore {
  id: string;
  name: string;
  location: string | null;
  status: string;
  created_at: string;
}

function AdminSuppliersPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stores, setStores] = useState<PendingStore[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data?.is_admin));
  }, [user]);

  async function loadAll() {
    const [{ data: inv }, { data: st }] = await Promise.all([
      supabase
        .from("supplier_invites")
        .select("id, token, note, used_by, used_at, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("supplier_stores")
        .select("id, name, location, status, created_at")
        .order("created_at", { ascending: false }),
    ]);
    setInvites(inv ?? []);
    setStores(st ?? []);
  }

  useEffect(() => {
    if (isAdmin) void loadAll();
  }, [isAdmin]);

  async function generateInvite() {
    if (!user) return;
    setCreating(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const { error } = await supabase.from("supplier_invites").insert({
        token,
        note: note.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      setNote("");
      await loadAll();
      toast.success(t("generate_invite"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/supplier/join/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      toast.success(t("link_copied"));
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function setStoreStatus(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("supplier_stores").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStores((s) => s.map((row) => (row.id === id ? { ...row, status } : row)));
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">{t("admin_only")}</p>
      </div>
    );
  }

  const pending = stores.filter((s) => s.status === "pending");
  const approved = stores.filter((s) => s.status === "approved");

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-card">
        <Link to="/settings" className="rounded-full p-1 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">{t("admin_suppliers")}</h1>
      </div>

      <div className="space-y-4 p-3">
        {/* Generate invite */}
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="mb-2 text-sm font-bold text-foreground">{t("generate_invite")}</p>
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("invite_note_ph")}
              className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={generateInvite}
              disabled={creating}
              className="flex h-11 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {creating ? "..." : t("generate_invite")}
            </button>
          </div>
        </div>

        {/* Active invites */}
        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("active_invites")} ({invites.filter((i) => !i.used_by).length})
          </p>
          <div className="space-y-2">
            {invites.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">{t("no_data")}</p>
            )}
            {invites.map((inv) => {
              const url = `${window.location.origin}/supplier/join/${inv.token}`;
              return (
                <div key={inv.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {inv.note ?? `Invite ${inv.token.slice(0, 6)}`}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{url}</p>
                    </div>
                    {inv.used_by ? (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        {t("used")}
                      </span>
                    ) : (
                      <button
                        onClick={() => copyLink(inv.token)}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95"
                      >
                        {copied === inv.token ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === inv.token ? t("link_copied") : t("copy_link")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending stores */}
        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-orange-600">
            {t("pending_stores")} ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">{t("no_data")}</p>
            )}
            {pending.map((s) => (
              <div key={s.id} className="rounded-xl border border-orange-500/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <StoreIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.location ?? "—"}</p>
                  </div>
                  <button
                    onClick={() => setStoreStatus(s.id, "approved")}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
                  >
                    {t("approve")}
                  </button>
                  <button
                    onClick={() => setStoreStatus(s.id, "rejected")}
                    className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground active:scale-95"
                  >
                    {t("reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Approved stores */}
        <div className="rounded-2xl bg-surface p-3 shadow-card">
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-green-700">
            {t("approved_stores")} ({approved.length})
          </p>
          <div className="space-y-2">
            {approved.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">{t("no_data")}</p>
            )}
            {approved.map((s) => (
              <Link
                key={s.id}
                to="/suppliers/$storeId"
                params={{ storeId: s.id }}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <StoreIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.location ?? "—"}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
