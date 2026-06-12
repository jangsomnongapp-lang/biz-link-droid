import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface EditTextField {
  key: string;
  label: string;
  initial: string;
  type?: "text" | "textarea" | "number";
  placeholder?: string;
  required?: boolean;
}

interface EditTextDialogProps {
  open: boolean;
  title: string;
  fields: EditTextField[];
  onCancel: () => void;
  onSave: (values: Record<string, string>) => Promise<void> | void;
}

/**
 * Lightweight inline editor for text/number fields. Used for editing posts,
 * comments, listings, and rentals without navigating away.
 */
export function EditTextDialog({ open, title, fields, onCancel, onSave }: EditTextDialogProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      for (const f of fields) init[f.key] = f.initial ?? "";
      setValues(init);
      setSaving(false);
    }
  }, [open, fields]);

  if (!open) return null;

  async function handleSave() {
    for (const f of fields) {
      if (f.required && !values[f.key]?.toString().trim()) return;
    }
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onCancel} className="rounded-full p-1 active:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="h-10 flex-1 rounded-lg border border-border text-sm font-medium active:bg-muted disabled:opacity-60"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="h-10 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? "..." : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
