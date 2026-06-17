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
  type PhotoSlot = "morning" | "midday" | "endofday";
  const [photo, setPhoto] = useState<Set<PhotoSlot>>(new Set());
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState("");

  const slotLabel = (opt: PhotoSlot) =>
    opt === "morning" ? (lang === "km" ? "ព្រឹក" : "Morning") :
    opt === "midday" ? (lang === "km" ? "ថ្ងៃត្រង់" : "Midday") :
    (lang === "km" ? "ល្ងាច" : "End of day");

  const togglePhoto = (opt: PhotoSlot) => {
    const next = new Set(photo);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    setPhoto(next);
  };

  const photoSummary = () => {
    if (photo.size === 0) return lang === "km" ? "មិនត្រូវការ" : "None";
    return (["morning", "midday", "endofday"] as PhotoSlot[])
      .filter((s) => photo.has(s))
      .map(slotLabel)
      .join(", ");
  };

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
          photoFrequency: photo.size === 0 ? null : Array.from(photo),
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

      {step === 2 && (
        <>
          <div className="flex-1 space-y-5 p-4 pb-32">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "km" ? "ជំហានទី ២ នៃ ៣" : "Step 2 of 3"}
            </div>
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
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["morning", "midday", "endofday"] as const).map((opt) => (
                  <SToggle key={opt} on={photo.has(opt)} onClick={() => togglePhoto(opt)} label={slotLabel(opt)} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {lang === "km" ? "អាចជ្រើសរើសច្រើនបាន" : "Select one or more times"}
              </p>
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
              onClick={() => setStep(3)}
              disabled={!worker || (hasPrice && !price)}
              style={{ backgroundColor: "#0F6E56" }}
              className="flex h-14 w-full flex-col items-center justify-center rounded-xl text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
            >
              <span>{lang === "km" ? "បន្ត — ពិនិត្យ" : "Continue — Review"}</span>
              <span className="text-[11px] font-normal opacity-90">
                {lang === "km" ? "ជំហានទី ៣ — បញ្ជាក់ និងផ្ញើ" : "Step 3 — confirm & send"}
              </span>
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="flex-1 space-y-4 p-4 pb-32">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {lang === "km" ? "ជំហានទី ៣ នៃ ៣" : "Step 3 of 3"}
              </div>
              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-xs font-semibold text-primary">
                <Pencil className="h-3.5 w-3.5" />
                {lang === "km" ? "កែសម្រួល" : "Edit"}
              </button>
            </div>

            <h2 className="text-lg font-bold">
              {lang === "km" ? "ពិនិត្យព័ត៌មានគម្រោង" : "Review project details"}
            </h2>
            <p className="-mt-2 text-sm text-muted-foreground">
              {lang === "km"
                ? "សូមផ្ទៀងផ្ទាត់ មុនពេលផ្ញើទៅកម្មករ។"
                : "Please double-check before sending to the worker."}
            </p>

            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="flex items-center gap-3 border-b border-border bg-emerald-50/40 p-3">
                <Avatar name={worker?.full_name} url={worker?.avatar_url} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {lang === "km" ? "កម្មករ" : "Worker"}
                  </div>
                  <div className="truncate text-sm font-bold">{workerName}</div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <SummaryRow
                label={lang === "km" ? "តម្លៃយល់ព្រម" : "Agreed price"}
                value={hasPrice ? (price ? `$${price}` : "—") : (lang === "km" ? "មិនកំណត់" : "Not set")}
              />
              <SummaryRow
                label={lang === "km" ? "ចូលធ្វើការ" : "Check-in"}
                value={checkin ? (lang === "km" ? "បាទ" : "Yes") : (lang === "km" ? "ទេ" : "No")}
              />
              <SummaryRow
                label={lang === "km" ? "ចេញពីការងារ" : "Check-out"}
                value={checkout ? (lang === "km" ? "បាទ" : "Yes") : (lang === "km" ? "ទេ" : "No")}
              />
              <SummaryRow
                label={lang === "km" ? "រូបភាពប្រចាំថ្ងៃ" : "Daily photos"}
                value={photoSummary()}
              />
              <SummaryRow
                label={lang === "km" ? "ថ្ងៃចាប់ផ្តើម" : "Start date"}
                value={startDate || "—"}
              />
              <SummaryRow
                label={lang === "km" ? "រយៈពេល" : "Duration"}
                value={duration || "—"}
                last
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {lang === "km"
                ? "បន្ទាប់ពីផ្ញើ កម្មករនឹងទទួលការដំណឹង ហើយត្រូវបញ្ជាក់ដើម្បីចាប់ផ្តើមគម្រោង។"
                : "After sending, the worker gets a notification and must confirm before the project starts."}
            </div>
          </div>

          <div className="sticky bottom-0 grid grid-cols-[auto_1fr] gap-2 border-t border-border bg-white p-3">
            <button
              onClick={() => setStep(2)}
              disabled={submitting}
              className="h-14 rounded-xl border border-border px-4 text-sm font-semibold text-foreground active:scale-[0.99] disabled:opacity-60"
            >
              {lang === "km" ? "ត្រឡប់" : "Back"}
            </button>
            <button
              onClick={send}
              disabled={submitting || !worker}
              style={{ backgroundColor: "#0F6E56" }}
              className="flex h-14 flex-col items-center justify-center rounded-xl text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
            >
              <span>
                {submitting
                  ? (lang === "km" ? "កំពុងផ្ញើ..." : "Sending...")
                  : `${lang === "km" ? "បញ្ជាក់ និងផ្ញើទៅ" : "Confirm & send to"} ${workerName}`}
              </span>
              <span className="text-[11px] font-normal opacity-90">
                {lang === "km" ? "កម្មករនឹងបញ្ជាក់ដើម្បីចាប់ផ្តើម" : "Worker will confirm to start the project"}
              </span>
            </button>
          </div>
        </>
      )}
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

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? "" : "border-b border-border"}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
