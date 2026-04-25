import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useI18n } from "@/lib/i18n";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/alerts")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <AlertsPage />
      </AppShell>
    </RequireAuth>
  ),
});

function AlertsPage() {
  const { t, lang } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Bell className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{t("nav_alerts")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {lang === "km" ? "ការជូនដំណឹងនឹងបង្ហាញនៅទីនេះ" : "Notifications will appear here"}
      </p>
    </div>
  );
}
