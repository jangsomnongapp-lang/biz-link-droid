import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface OwnerMenuProps {
  onEdit?: () => void;
  onDelete?: () => void;
  iconClassName?: string;
  align?: "left" | "right";
}

/**
 * 3-dot menu shown to the author of a post/comment/listing/etc with Edit + Delete actions.
 */
export function OwnerMenu({ onEdit, onDelete, iconClassName, align = "right" }: OwnerMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-full p-1 active:opacity-60"
        aria-label={t("more")}
      >
        <MoreHorizontal className={`h-5 w-5 ${iconClassName ?? "text-muted-foreground"}`} />
      </button>
      {open && (
        <div
          className={`absolute top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground active:bg-muted"
            >
              <Pencil className="h-4 w-4" />
              {t("edit")}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive active:bg-muted"
            >
              <Trash2 className="h-4 w-4" />
              {t("delete")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
