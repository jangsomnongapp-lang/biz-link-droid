import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { createProjectRequest } from "@/lib/projects.functions";
import { ArrowLeft, CheckCircle2, Pencil } from "lucide-react";
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
  const [step, setStep] = useState<2 | 3>(2);
  const create = useServerFn(createProjectRequest);

  const [hasPrice, setHasPrice] = useState(true);
  const [price, setPrice] = useState("");
  const [checkin, setCheckin] = useState(true);
  const [checkout, setCheckout] = useState(false);
  const [photo, setPhoto] = useState<"none" | "morning" | "midday" | "endofday">("none");
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState("");

  const photoLabel = (opt: typeof photo) =>
    opt === "none" ? (lang === "km" ? "មិនត្រូវការ" : "None") :
    opt === "morning" ? (lang === "km" ? "ព្រឹក" : "Morning") :
    opt === "midday" ? (lang === "km" ? "ថ្ងៃត្រង់" : "Midday") :
    (lang === "km" ? "ល្ងាច" : "End of day");

  useEffect(() => {
    void supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", workerId)
      .maybeSingle()
      .then(({ data }) => setWorker(data));
  }, [workerId]);

  const workerName = worker?.full_name ?? "—";

  async function send() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const res = await create({
        headers: { Authorization: `Bearer ${session.access_token}` },
        data: {
          workerId,
          agreedPrice: hasPrice && price ? Number(price) : null,
          checkinRequired: checkin,
          checkoutRequired: checkout,
          photoFrequency: photo === "none" ? null : photo,
          startDate: startDate || null,
          duration: duration || null,
        },
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
        <div>
          <SLabel>{lang === "km" ? "ជ្រើសរើសកម្មករ" : "Selected worker / company"}</SLabel>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <Avatar name={worker?.full_name} url={worker?.avatar_url} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{workerName}</div>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
        </div>

        <div>
          <SLabel>{lang === "km" ? "តម្លៃយល់ព្រម" : "Agreed price"}</SLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <SToggle on={hasPrice} onClick={() => setHasPrice(true)} label={lang === "km" ? "បាទ — កំណត់តម្លៃ" : "Yes — set price"} />
            <SToggle on={!hasPrice} onClick={() => setHasPrice(false)} label={lang === "km" ? "មិនកំណត់" : "No price"} />
          </div>
          {hasPrice && (
            <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3">
              <span className="text-sm text-muted-foreground">$</span>
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1,200" className="flex-1 bg-transparent text-sm outline-none" />
            </div>
          )}
        </div>

        <div>
          <SLabel>{lang === "km" ? "តាមដានវត្តមាន" : "Attendance tracking"}</SLabel>
          <SSwitch label={lang === "km" ? "ចូលធ្វើការ" : "Check-in on arrival"} on={checkin} onChange={setCheckin} />
          <SSwitch label={lang === "km" ? "ចេញពីការងារ" : "Check-out on leave"} on={checkout} onChange={setCheckout} />
        </div>

        <div>
          <SLabel>{lang === "km" ? "រូបភាពវឌ្ឍនភាពប្រចាំថ្ងៃ" : "Daily progress photos"}</SLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["none", "morning", "midday", "endofday"] as const).map((opt) => (
              <SToggle key={opt} on={photo === opt} onClick={() => setPhoto(opt)} label={
                opt === "none" ? (lang === "km" ? "មិនត្រូវការ" : "None") :
                opt === "morning" ? (lang === "km" ? "ព្រឹក" : "Morning") :
                opt === "midday" ? (lang === "km" ? "ថ្ងៃត្រង់" : "Midday") :
                (lang === "km" ? "ល្ងាច" : "End of day")
              } />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <SLabel>{lang === "km" ? "ថ្ងៃចាប់ផ្តើម" : "Start date"}</SLabel>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none" />
          </div>
          <div>
            <SLabel>{lang === "km" ? "រយៈពេល" : "Duration"}</SLabel>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={lang === "km" ? "៣ សប្តាហ៍" : "3 weeks"} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none" />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-white p-3">
        <button
          onClick={send}
          disabled={submitting || !worker}
          style={{ backgroundColor: "#0F6E56" }}
          className="flex h-14 w-full flex-col items-center justify-center rounded-xl text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
        >
          <span>
            {submitting
              ? (lang === "km" ? "កំពុងផ្ញើ..." : "Sending...")
              : `${lang === "km" ? "ផ្ញើទៅ" : "Send to"} ${workerName}`}
          </span>
          <span className="text-[11px] font-normal opacity-90">
            {lang === "km" ? "កម្មករនឹងបញ្ជាក់ដើម្បីចាប់ផ្តើម" : "Worker will confirm to start the project"}
          </span>
        </button>
      </div>
    </div>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}
function SToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`}>
      {label}
    </button>
  );
}
function SSwitch({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className="mt-2 flex h-12 w-full items-center justify-between rounded-xl border border-border bg-surface px-3 text-sm">
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
