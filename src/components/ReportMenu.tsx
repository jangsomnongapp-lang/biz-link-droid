import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Flag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

interface Props {
  targetKind: "post" | "listing" | "profile";
  targetId: string;
  className?: string;
  /** Optional override for the trigger button color (icon color). */
  iconClassName?: string;
}

export function ReportMenu({ targetKind, targetId, className, iconClassName }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function submit() {
    if (!user) {
      toast.error(t("login"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_kind: targetKind,
      target_id: targetId,
      reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setShowDialog(false);
    setReason("");
    toast.success(t("report_sent"));
  }

  return (
    <>
      <div ref={wrapRef} className={`relative ${className ?? ""}`}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="rounded-full p-1.5 active:bg-muted"
          aria-label={t("more")}
        >
          <MoreHorizontal className={`h-5 w-5 ${iconClassName ?? "text-muted-foreground"}`} />
        </button>
        {open && (
          <div className="absolute right-0 top-9 z-30 min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowDialog(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive active:bg-muted"
            >
              <Flag className="h-4 w-4" />
              {t("report")}
            </button>
          </div>
        )}
      </div>

      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => !submitting && setShowDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-surface p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Flag className="h-4 w-4 text-destructive" />
                {t("report")}
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="rounded-full p-1 active:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{t("report_desc")}</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder={t("report_reason_ph")}
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setShowDialog(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold"
              >
                {t("back")}
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? t("loading") : t("send_report")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
