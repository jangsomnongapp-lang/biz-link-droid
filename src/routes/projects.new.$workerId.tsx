import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { createProjectRequest } from "@/lib/projects.functions";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/projects/new/$workerId")({
  component: () => (
    <RequireAuth>
      <NewProjectPage />
    </RequireAuth>
  ),
});

function NewProjectPage() {
  const { lang } = useI18n();
  const nav = useNavigate();
  const { workerId } = useParams({ from: "/projects/new/$workerId" });
  const [worker, setWorker] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const create = useServerFn(createProjectRequest);

  useEffect(() => {
    void supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", workerId)
      .maybeSingle()
      .then(({ data }) => setWorker(data));
  }, [workerId]);

  async function send() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const res = await create({
        headers: { Authorization: `Bearer ${session.access_token}` },
        data: { workerId },
      });
      toast.success(lang === "km" ? "បានផ្ញើ" : "Request sent");
      nav({ to: "/projects/$projectId", params: { projectId: res.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-foreground">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/users/$userId" params={{ userId: workerId }} className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "ចាប់ផ្តើមគម្រោង" : "Start a project"}
        </h1>
        <span className="w-9" />
      </header>

      <div className="flex-1 space-y-5 p-4 pb-32">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <Avatar name={worker?.full_name} url={worker?.avatar_url} size={48} />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">
              {lang === "km" ? "ផ្ញើសំណើទៅ" : "Send request to"}
            </div>
            <div className="truncate text-base font-bold">{worker?.full_name ?? "—"}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted-foreground">
          {lang === "km"
            ? "ចុចផ្ញើដើម្បីសុំចាប់ផ្តើមគម្រោងជាមួយអ្នកនេះ។ បន្ទាប់ពីពួកគេទទួលយក អ្នកអាចកំណត់តម្លៃ ការចូលចេញ រូបភាព និងកាលបរិច្ឆេទ។"
            : "Tap send to ask this person to start a project. After they accept, you can set the agreed price, check-in / check-out, photo schedule and dates."}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-white p-3">
        <button
          onClick={send}
          disabled={submitting || !worker}
          style={{ backgroundColor: "#0F6E56" }}
          className="flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
        >
          {submitting
            ? (lang === "km" ? "កំពុងផ្ញើ..." : "Sending...")
            : `${lang === "km" ? "ផ្ញើទៅ" : "Send to"} ${worker?.full_name ?? ""}`}
        </button>
      </div>
    </div>
  );
}
