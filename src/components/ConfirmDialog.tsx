import { useI18n } from "@/lib/i18n";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** Simple modal confirm — used before destructive actions like delete. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">{title ?? t("delete")}</h3>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="h-10 flex-1 rounded-lg border border-border text-sm font-medium active:bg-muted"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => void onConfirm()}
            className={`h-10 flex-1 rounded-lg text-sm font-semibold text-white active:scale-[0.99] ${
              destructive ? "bg-destructive" : "bg-primary"
            }`}
          >
            {confirmLabel ?? t("delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
