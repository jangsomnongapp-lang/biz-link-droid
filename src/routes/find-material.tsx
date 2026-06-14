import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera, Plus, FileText } from "lucide-react";

export const Route = createFileRoute("/find-material")({
  component: () => (
    <RequireAuth>
      <FindMaterialRoute />
    </RequireAuth>
  ),
});

function FindMaterialRoute() {
  const location = useLocation();
  if (location.pathname !== "/find-material") return <Outlet />;
  return <FindMaterialEntry />;
}

function FindMaterialEntry() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [activeCount, setActiveCount] = useState(0);
  const MAX = 10;

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("material_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .then(({ count }) => setActiveCount(count ?? 0));
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center bg-primary px-3 text-primary-foreground">
        <Link to="/home" className="rounded-full p-2 active:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "រកសម្ភារៈរបស់ខ្ញុំ" : "Find my material"}
        </h1>
        <span className="w-9" />
      </header>

      <div className="flex flex-col gap-3 px-4 py-6">
        <Button asChild size="lg" className="h-auto justify-start rounded-2xl px-4 py-4 shadow-card">
          <Link to="/find-material/new" search={{ scan: true }}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20">
              <Camera className="h-5 w-5" />
            </span>
            <span className="text-left">
              <span className="block text-base font-bold">
                {lang === "km" ? "ស្កេនរូបភាព" : "Scan picture"}
              </span>
              <span className="block text-xs font-normal text-primary-foreground/80">
                {lang === "km" ? "ថតរូបដើម្បីស្វែងរកផលិតផល" : "Take a photo to identify the product"}
              </span>
            </span>
          </Link>
        </Button>

        <Link
          to="/find-material/new"
          className="flex items-center gap-3 rounded-2xl bg-[#c87000] px-4 py-4 text-white shadow-card active:opacity-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold">
              {lang === "km" ? "ស្វែងរកសម្ភារៈថ្មី" : "New material search"}
            </div>
            <div className="text-xs text-white/80">
              {lang === "km" ? "រកអ្នកផ្គត់ផ្គង់ជិតអ្នក" : "Find suppliers near you"}
            </div>
          </div>
        </Link>

        <Link
          to="/find-material/mine"
          className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-4 shadow-card active:bg-muted"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <FileText className="h-5 w-5 text-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-foreground">
              {lang === "km" ? "ការស្វែងរករបស់ខ្ញុំ" : "My searches"}
            </div>
            <div className="text-xs text-muted-foreground">
              {lang === "km" ? "មើល · កែ · បោះបង់សំណើ" : "View · edit · cancel requests"}
            </div>
          </div>
          {activeCount > 0 && (
            <span className="rounded-full bg-[#c87000] px-2.5 py-1 text-xs font-bold text-white">
              {activeCount} {lang === "km" ? "សកម្ម" : "active"}
            </span>
          )}
        </Link>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          {lang === "km"
            ? `អ្នកមានការស្វែងរក ${activeCount} នៃ ${MAX} · សល់ ${MAX - activeCount}`
            : `You have ${activeCount} of ${MAX} active searches · ${MAX - activeCount} remaining`}
        </p>
      </div>
    </div>
  );
}
