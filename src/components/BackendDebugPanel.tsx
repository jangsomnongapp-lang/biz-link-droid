import { useEffect, useState } from "react";
import { Database, Check, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shows which backend the app is actually talking to.
 * Only publishable/non-secret values are displayed.
 */
export function BackendDebugPanel() {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "(not set)";
  const projectId =
    import.meta.env.VITE_SUPABASE_PROJECT_ID ??
    (typeof url === "string" ? url.match(/https:\/\/([^.]+)\./)?.[1] : undefined) ??
    "(not set)";
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ error }) => {
      if (!cancelled) setReachable(!error);
    }).catch(() => {
      if (!cancelled) setReachable(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function copy() {
    void navigator.clipboard
      .writeText(`SUPABASE_URL=${url}\nSUPABASE_PROJECT_ID=${projectId}`)
      .then(() => toast.success("Copied backend info"))
      .catch(() => toast.error("Copy failed"));
  }

  return (
    <div className="mx-3 mt-4 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Database className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Backend debug</p>
          <p className="text-[11px] text-muted-foreground">Active database connection</p>
        </div>
        <button onClick={copy} className="tap rounded-lg p-2 text-muted-foreground active:bg-muted" aria-label="Copy">
          <Copy className="h-4 w-4" />
        </button>
      </div>

      <dl className="space-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">SUPABASE_URL</dt>
          <dd className="break-all font-mono text-foreground">{url}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">SUPABASE_PROJECT_ID</dt>
          <dd className="break-all font-mono text-foreground">{projectId}</dd>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          {reachable === null ? (
            <span className="text-muted-foreground">Checking connection…</span>
          ) : reachable ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-600">Auth client reachable</span>
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive">Auth client unreachable</span>
            </>
          )}
        </div>
      </dl>
    </div>
  );
}
