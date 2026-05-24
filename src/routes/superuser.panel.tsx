import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import {
  listIdentities,
  createIdentity,
  switchToIdentity,
  getUnifiedInbox,
  setIdentityPhoneLogin,
} from "@/server/super-user.functions";
import { toast } from "sonner";
import { Plus, Inbox, X, ArrowLeft, Phone } from "lucide-react";

export const Route = createFileRoute("/superuser/panel")({
  component: () => (
    <RequireAuth>
      <SuperUserPanel />
    </RequireAuth>
  ),
  notFoundComponent: () => <NotFound404 />,
});

function NotFound404() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground">Page not found</p>
      </div>
    </div>
  );
}

interface IdentityRow {
  id: string;
  identity_user_id: string;
  display_order: number;
  avatar_shape: string;
  is_official: boolean;
  badges: string[];
  description: string | null;
  unread: number;
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

function SuperUserPanel() {
  const nav = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const list = useServerFn(listIdentities);
  const switchFn = useServerFn(switchToIdentity);
  const inboxFn = useServerFn(getUnifiedInbox);
  const createFn = useServerFn(createIdentity);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showInbox, setShowInbox] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [phoneTarget, setPhoneTarget] = useState<IdentityRow | null>(null);
  const setPhoneFn = useServerFn(setIdentityPhoneLogin);

  function authHeaders() {
    if (!session?.access_token) throw new Error("Missing session");
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function load() {
    try {
      const [{ data: u }, res] = await Promise.all([
        supabase.auth.getUser(),
        list({ headers: authHeaders() }),
      ]);
      setActiveId(u.user?.id ?? null);
      if (res?.forbidden) {
        setForbidden(true);
        setIdentities([]);
        setMasterId(null);
        return;
      }
      setForbidden(false);
      setMasterId(res?.masterId ?? null);
      setIdentities(Array.isArray(res?.identities) ? (res.identities as IdentityRow[]) : []);
    } catch (e: any) {
      if (String(e?.message ?? "").includes("Forbidden")) {
        setForbidden(true);
      } else {
        toast.error(e?.message ?? "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user || !session?.access_token) return;
    void load();
  }, [authLoading, user?.id, session?.access_token]);

  async function handleSwitch(targetUserId: string) {
    try {
      const { token_hash } = await switchFn({
        data: { target_user_id: targetUserId },
        headers: authHeaders(),
      });
      const { error } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash,
      });
      if (error) throw error;
      toast.success("Switched");
      nav({ to: "/home" });
    } catch (e: any) {
      toast.error(e?.message ?? "Switch failed");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b1a] text-white/70">
        Loading…
      </div>
    );
  }
  // Pretend route doesn't exist for non-super-users
  if (forbidden) return <NotFound404 />;

  const safeIdentities = Array.isArray(identities) ? identities : [];
  const totalUnread = safeIdentities.reduce((a, b) => a + (b.unread ?? 0), 0);
  const masterRow: IdentityRow | undefined = masterId
    ? {
        id: "__master__",
        identity_user_id: masterId,
        display_order: 1,
        avatar_shape: "square",
        is_official: true,
        badges: ["Admin panel", "All post types"],
        description: "Official BuildHub account — admin badge visible to users",
        unread: 0,
        profile: safeIdentities.find((i) => i.identity_user_id === masterId)?.profile ?? null,
      }
    : undefined;
  const others = safeIdentities.filter((i) => i.identity_user_id !== masterId);

  return (
    <div className="min-h-screen bg-[#0b0b1a] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-[#13132a] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold">
                B
              </div>
              <div>
                <h1 className="text-base font-semibold">BuildHub — Super User Panel</h1>
                <p className="text-[11px] text-white/50">Logged in as Super User</p>
              </div>
            </div>
            <button
              onClick={() => setShowInbox(true)}
              className="relative rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold"
            >
              <Inbox className="mr-1 inline h-3.5 w-3.5" /> Unified inbox
              {totalUnread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold">
                  {totalUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Identities */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#13132a] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Active identities</h2>
              <p className="text-[11px] text-white/50">
                Click any identity to switch — users never know it's you
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold"
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" /> Create new identity
            </button>
          </div>

          <div className="space-y-2">
            {masterRow && (
              <IdentityCard
                row={masterRow}
                active={activeId === masterRow.identity_user_id}
                onSwitch={() => handleSwitch(masterRow.identity_user_id)}
              />
            )}
            {others.map((row) => (
              <IdentityCard
                key={row.id}
                row={row}
                active={activeId === row.identity_user_id}
                onSwitch={() => handleSwitch(row.identity_user_id)}
                onAssignPhone={() => setPhoneTarget(row)}
              />
            ))}
            {others.length === 0 && (
              <p className="py-6 text-center text-xs text-white/40">
                No identities yet. Create one to get started.
              </p>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] text-white/40">
            All messages from all identities arrive in the unified inbox · Users never see this panel
          </p>
        </div>
      </div>

      {showInbox && (
        <UnifiedInbox
          onClose={() => setShowInbox(false)}
          loadFn={inboxFn}
          authHeaders={authHeaders}
        />
      )}
      {showCreate && (
        <CreateIdentitySheet
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
          createFn={createFn}
          authHeaders={authHeaders}
        />
      )}
      {phoneTarget && (
        <AssignPhoneSheet
          row={phoneTarget}
          onClose={() => setPhoneTarget(null)}
          onSaved={() => {
            setPhoneTarget(null);
            void load();
          }}
          setPhoneFn={setPhoneFn}
          authHeaders={authHeaders}
        />
      )}
    </div>
  );
}

function IdentityCard({
  row,
  active,
  onSwitch,
  onAssignPhone,
}: {
  row: IdentityRow;
  active: boolean;
  onSwitch: () => void;
  onAssignPhone?: () => void;
}) {
  const initials =
    (row.profile?.full_name ?? "??")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "??";
  const isOfficial = row.is_official;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSwitch}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-[#1a1a35] px-4 py-3 text-left transition-colors active:scale-[0.99] ${
        isOfficial ? "border-primary" : "border-white/10 hover:border-white/20"
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center bg-primary text-sm font-bold text-white ${
          row.avatar_shape === "square" ? "rounded-lg" : "rounded-full"
        }`}
        style={
          row.profile?.avatar_url
            ? { backgroundImage: `url(${row.profile.avatar_url})`, backgroundSize: "cover" }
            : undefined
        }
      >
        {!row.profile?.avatar_url && initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {row.profile?.full_name ?? "Unnamed"}
          </span>
          {isOfficial && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
              Official
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-white/50">{row.description ?? ""}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onAssignPhone && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssignPhone();
            }}
            title="Assign phone login"
            className="rounded-full bg-white/10 p-1.5 hover:bg-primary"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
        )}
        {row.badges.slice(0, 2).map((b) => (
          <span
            key={b}
            className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70 sm:inline"
          >
            {b}
          </span>
        ))}
        {row.unread > 0 && (
          <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold">
            {row.unread}
          </span>
        )}
        <span
          className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-white/20"}`}
        />
      </div>
    </div>
  );
}

function CreateIdentitySheet({
  onClose,
  onCreated,
  createFn,
  authHeaders,
}: {
  onClose: () => void;
  onCreated: () => void;
  createFn: ReturnType<typeof useServerFn<typeof createIdentity>>;
  authHeaders: () => { Authorization: string };
}) {
  const [full_name, setName] = useState("");
  const [user_type, setType] = useState<"worker" | "company" | "supplier" | "client" | "specialist">(
    "worker",
  );
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!full_name.trim()) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    try {
      await createFn({
        data: {
          full_name: full_name.trim(),
          user_type,
          location: location.trim(),
          description: description.trim(),
          avatar_shape: user_type === "company" || user_type === "supplier" ? "square" : "circle",
          badges: [],
        },
        headers: authHeaders(),
      });
      toast.success("Identity created");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-[#13132a] p-5 text-white sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Create new identity</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Name">
            <input
              value={full_name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-[#0b0b1a] px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
            />
          </Field>
          <Field label="User type">
            <select
              value={user_type}
              onChange={(e) => setType(e.target.value as typeof user_type)}
              className="w-full rounded-lg bg-[#0b0b1a] px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
            >
              <option value="worker">Worker</option>
              <option value="company">Company</option>
              <option value="supplier">Supplier</option>
              <option value="client">Owner</option>
              <option value="specialist">Specialist</option>
            </select>
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Phnom Penh"
              className="w-full rounded-lg bg-[#0b0b1a] px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
            />
          </Field>
          <Field label="Short description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-[#0b0b1a] px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
            />
          </Field>
          <button
            onClick={save}
            disabled={saving}
            className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create identity"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function UnifiedInbox({
  onClose,
  loadFn,
  authHeaders,
}: {
  onClose: () => void;
  loadFn: ReturnType<typeof useServerFn<typeof getUnifiedInbox>>;
  authHeaders: () => { Authorization: string };
}) {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<any[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await loadFn({ headers: authHeaders() });
        setThreads(res.threads);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadFn]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b1a] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-semibold">Unified inbox</h2>
        <div className="w-9" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-center text-xs text-white/50">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="p-6 text-center text-xs text-white/50">No messages.</p>
        ) : (
          threads.map((t) => (
            <button
              key={t.thread_id}
              onClick={() => {
                onClose();
                nav({ to: "/messages/$threadId", params: { threadId: t.thread_id } });
              }}
              className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left hover:bg-white/5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold">
                {(t.other_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{t.other_name ?? "Unknown"}</span>
                  {t.unread > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold">
                      {t.unread}
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-white/50">
                  <span className="text-primary">{t.identity_name ?? "?"}</span> received ·{" "}
                  {t.last_message ?? ""}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
