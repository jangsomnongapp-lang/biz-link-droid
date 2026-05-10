import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  configureProject,
  requestCompletion,
  cancelCompletion,
  confirmCompletion,
  submitRating,
} from "@/lib/projects.functions";
import { Camera, CheckCircle2, ChevronDown, ChevronUp, Clock, LogIn, LogOut, Star } from "lucide-react";

interface Project {
  id: string;
  owner_id: string;
  worker_id: string;
  status: "pending" | "active" | "completed" | "declined";
  agreed_price: number | null;
  checkin_required: boolean;
  checkout_required: boolean;
  photo_frequency: "morning" | "midday" | "endofday" | null;
  start_date: string | null;
  duration: string | null;
  completion_requested_by: string | null;
  setup_completed: boolean;
  created_at: string;
}
interface LogRow {
  id: string;
  user_id: string;
  log_type: "checkin" | "checkout" | "photo";
  photo_url: string | null;
  created_at: string;
}
interface RatingRow {
  id: string;
  rater_id: string;
  rated_id: string;
  stars: number;
  comment: string | null;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

export function ChatProjectPanel({ otherUserId, otherName }: { otherUserId: string; otherName: string }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showRate, setShowRate] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const configureFn = useServerFn(configureProject);
  const requestFn = useServerFn(requestCompletion);
  const cancelFn = useServerFn(cancelCompletion);
  const confirmFn = useServerFn(confirmCompletion);
  const rateFn = useServerFn(submitRating);

  // Find latest project between the two users
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .or(
          `and(owner_id.eq.${user!.id},worker_id.eq.${otherUserId}),and(owner_id.eq.${otherUserId},worker_id.eq.${user!.id})`,
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setProject((data as Project) ?? null);
      if (data?.id) {
        const [{ data: l }, { data: r }] = await Promise.all([
          supabase.from("project_logs").select("*").eq("project_id", data.id).order("created_at", { ascending: false }).limit(50),
          supabase.from("project_ratings").select("id, rater_id, rated_id, stars, comment").eq("project_id", data.id),
        ]);
        if (cancelled) return;
        setLogs((l ?? []) as LogRow[]);
        setRatings((r ?? []) as RatingRow[]);
      }
    }
    void load();
    const channel = supabase
      .channel(`chat-project-${user.id}-${otherUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_logs" }, (p) => {
        const row = p.new as LogRow & { project_id: string };
        setProject((cur) => {
          if (cur && row.project_id === cur.id) setLogs((prev) => [row, ...prev]);
          return cur;
        });
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [user, otherUserId]);

  if (!user || !project) return null;
  if (project.status === "declined") return null;

  const isOwner = user.id === project.owner_id;
  const me = isOwner ? "owner" : "worker";
  const today = new Date().toDateString();
  const myLogsToday = logs.filter((l) => l.user_id === user.id && new Date(l.created_at).toDateString() === today);
  const checkedInToday = myLogsToday.some((l) => l.log_type === "checkin");
  const checkedOutToday = myLogsToday.some((l) => l.log_type === "checkout");
  const photosToday = myLogsToday.filter((l) => l.log_type === "photo").length;
  const completionByOther = !!project.completion_requested_by && project.completion_requested_by !== user.id;
  const completionByMe = project.completion_requested_by === user.id;
  const myRating = ratings.find((r) => r.rater_id === user.id);
  const otherRating = ratings.find((r) => r.rater_id === otherUserId);

  async function recordLog(type: "checkin" | "checkout") {
    const { error } = await supabase.from("project_logs").insert({ project_id: project!.id, user_id: user!.id, log_type: type });
    if (error) toast.error(error.message);
  }
  async function uploadPhoto(file: File) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${project!.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("project-photos").upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("project-photos").getPublicUrl(path);
    const { error } = await supabase.from("project_logs").insert({ project_id: project!.id, user_id: user!.id, log_type: "photo", photo_url: pub.publicUrl });
    if (error) toast.error(error.message); else toast.success(lang === "km" ? "បានផ្ទុកឡើង" : "Uploaded");
  }

  const statusBadge =
    project.status === "completed" ? (lang === "km" ? "បានបញ្ចប់" : "Completed") :
    project.status === "pending" ? (lang === "km" ? "កំពុងរង់ចាំ" : "Pending") :
    !project.setup_completed ? (lang === "km" ? "ត្រៀមរៀបចំ" : "Setup needed") :
    (lang === "km" ? "សកម្ម" : "Active");

  return (
    <div className="border-b border-border bg-emerald-50/40">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-900">{lang === "km" ? "គម្រោង" : "Project"}</div>
            <div className="text-[11px] text-emerald-700">{statusBadge}{project.agreed_price != null ? ` · $${project.agreed_price}` : ""}</div>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-emerald-700" /> : <ChevronDown className="h-4 w-4 text-emerald-700" />}
      </button>

      {expanded && (
        <div className="space-y-2 px-3 pb-3">
          {/* Owner setup */}
          {project.status === "active" && !project.setup_completed && me === "owner" && (
            <SetupForm
              busy={busy}
              workerName={otherName}
              onSubmit={async (vals) => {
                if (busy) return;
                setBusy(true);
                try {
                  await configureFn({ headers: await authHeaders(), data: { projectId: project.id, ...vals } });
                  toast.success(lang === "km" ? "បានចាប់ផ្តើម" : "Project started");
                } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
              }}
            />
          )}
          {project.status === "active" && !project.setup_completed && me === "worker" && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-white p-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {lang === "km" ? `កំពុងរង់ចាំ ${otherName} កំណត់លក្ខខណ្ឌ...` : `Waiting for ${otherName} to set up project details...`}
            </div>
          )}

          {/* Active worker controls */}
          {project.status === "active" && project.setup_completed && me === "worker" && (
            <div className="grid grid-cols-3 gap-2">
              {project.checkin_required && (
                <PanelBtn
                  onClick={() => recordLog("checkin")}
                  disabled={checkedInToday}
                  color="#0F6E56"
                  icon={<LogIn className="h-4 w-4" />}
                  label={checkedInToday ? (lang === "km" ? "បានចូល" : "In ✓") : (lang === "km" ? "ចូល" : "Check in")}
                />
              )}
              {project.checkout_required && (
                <PanelBtn
                  onClick={() => recordLog("checkout")}
                  disabled={checkedOutToday || (project.checkin_required && !checkedInToday)}
                  color="#1e40af"
                  icon={<LogOut className="h-4 w-4" />}
                  label={checkedOutToday ? (lang === "km" ? "បានចេញ" : "Out ✓") : (lang === "km" ? "ចេញ" : "Check out")}
                />
              )}
              {project.photo_frequency && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadPhoto(f); }}
                  />
                  <PanelBtn
                    onClick={() => fileInput.current?.click()}
                    color="#475569"
                    icon={<Camera className="h-4 w-4" />}
                    label={`${lang === "km" ? "រូប" : "Photo"} (${photosToday})`}
                  />
                </>
              )}
            </div>
          )}

          {/* Owner stats / latest activity */}
          {project.status === "active" && project.setup_completed && me === "owner" && (
            <div className="rounded-lg border border-border bg-white p-2 text-xs">
              {logs[0] ? (
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${logs[0].log_type === "checkin" ? "bg-emerald-500" : logs[0].log_type === "checkout" ? "bg-blue-500" : "bg-slate-500"}`} />
                  <span className="capitalize">{logs[0].log_type}</span>
                  <span className="text-muted-foreground">· {new Date(logs[0].created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">{lang === "km" ? "គ្មានសកម្មភាពនៅឡើយ" : "No activity yet"}</span>
              )}
            </div>
          )}

          {/* Completion banners */}
          {project.status === "active" && completionByOther && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
              <p className="text-xs text-amber-900">
                <strong>{otherName}</strong> {lang === "km" ? "និយាយថាការងារបានបញ្ចប់។" : "says the work is finished."}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={async () => { setBusy(true); try { await cancelFn({ headers: await authHeaders(), data: { projectId: project.id } }); } finally { setBusy(false); } }}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-rose-300 bg-rose-50 py-2 text-xs font-semibold text-rose-800"
                >
                  {lang === "km" ? "មិនទាន់" : "No"}
                </button>
                <button
                  onClick={async () => { setBusy(true); try { await confirmFn({ headers: await authHeaders(), data: { projectId: project.id } }); setShowRate(true); } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); } }}
                  disabled={busy}
                  style={{ backgroundColor: "#0F6E56" }}
                  className="flex-1 rounded-lg py-2 text-xs font-semibold text-white"
                >
                  {lang === "km" ? "បាទ បញ្ជាក់" : "Yes, confirm"}
                </button>
              </div>
            </div>
          )}
          {project.status === "active" && completionByMe && (
            <div className="rounded-lg border border-border bg-white p-2 text-[11px] text-muted-foreground">
              {lang === "km" ? "កំពុងរង់ចាំការបញ្ជាក់..." : "Waiting for the other party to confirm..."}
            </div>
          )}

          {/* Mark complete */}
          {project.status === "active" && project.setup_completed && !completionByOther && !completionByMe && (
            <button
              onClick={async () => { setBusy(true); try { await requestFn({ headers: await authHeaders(), data: { projectId: project.id } }); toast.success(lang === "km" ? "បានស្នើ" : "Completion requested"); } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); } }}
              disabled={busy}
              style={{ backgroundColor: "#0F6E56" }}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {lang === "km" ? "សម្គាល់ថាបានបញ្ចប់" : "Mark as completed"}
            </button>
          )}

          {/* Ratings */}
          {project.status === "completed" && (
            <div className="rounded-lg border border-border bg-white p-2">
              {myRating ? (
                <div className="flex items-center gap-2 text-xs">
                  <span>{lang === "km" ? "អ្នកបានវាយតម្លៃ" : "You rated"}:</span>
                  <Stars value={myRating.stars} />
                </div>
              ) : (
                <button
                  onClick={() => setShowRate(true)}
                  className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  {lang === "km" ? "វាយតម្លៃឥឡូវនេះ" : "Rate now"}
                </button>
              )}
              {otherRating && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span>{otherName}:</span>
                  <Stars value={otherRating.stars} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showRate && project.status === "completed" && !myRating && (
        <RateSheet
          name={otherName}
          onClose={() => setShowRate(false)}
          onSubmit={async (stars, comment) => {
            try {
              await rateFn({ headers: await authHeaders(), data: { projectId: project.id, stars, comment } });
              const { data: r } = await supabase.from("project_ratings").select("id, rater_id, rated_id, stars, comment").eq("project_id", project.id);
              setRatings((r ?? []) as RatingRow[]);
              setShowRate(false);
              toast.success(lang === "km" ? "បានដាក់ស្នើ" : "Submitted");
            } catch (e: any) { toast.error(e?.message ?? "Failed"); }
          }}
        />
      )}
    </div>
  );
}

interface SetupValues {
  agreedPrice: number | null;
  checkinRequired: boolean;
  checkoutRequired: boolean;
  photoFrequency: "morning" | "midday" | "endofday" | null;
  startDate: string | null;
  duration: string | null;
}

function SetupForm({ busy, workerName, onSubmit }: { busy: boolean; workerName: string; onSubmit: (v: SetupValues) => Promise<void> }) {
  const { lang } = useI18n();
  const [hasPrice, setHasPrice] = useState(false);
  const [price, setPrice] = useState("");
  const [checkin, setCheckin] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [photo, setPhoto] = useState<"none" | "morning" | "midday" | "endofday">("none");
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState("");

  return (
    <div className="space-y-3 rounded-lg border border-border bg-white p-3">
      <div className="text-xs font-semibold text-foreground">
        {lang === "km" ? "កំណត់លក្ខខណ្ឌគម្រោង" : "Set up project details"}
      </div>

      <div>
        <Label>{lang === "km" ? "តម្លៃ" : "Agreed price"}</Label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <Toggle on={hasPrice} onClick={() => setHasPrice(true)} label={lang === "km" ? "កំណត់តម្លៃ" : "Set price"} />
          <Toggle on={!hasPrice} onClick={() => setHasPrice(false)} label={lang === "km" ? "មិនកំណត់" : "No price"} />
        </div>
        {hasPrice && (
          <div className="mt-1.5 flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2">
            <span className="text-xs text-muted-foreground">$</span>
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1,200" className="flex-1 bg-transparent text-xs outline-none" />
          </div>
        )}
      </div>

      <div>
        <Label>{lang === "km" ? "តាមដានវត្តមាន" : "Attendance"}</Label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <Toggle on={checkin} onClick={() => setCheckin((v) => !v)} label={lang === "km" ? "ចូល" : "Check-in"} />
          <Toggle on={checkout} onClick={() => setCheckout((v) => !v)} label={lang === "km" ? "ចេញ" : "Check-out"} />
        </div>
      </div>

      <div>
        <Label>{lang === "km" ? "រូបភាពប្រចាំថ្ងៃ" : "Daily photos"}</Label>
        <div className="mt-1 grid grid-cols-4 gap-1.5">
          {(["none", "morning", "midday", "endofday"] as const).map((opt) => (
            <Toggle
              key={opt}
              on={photo === opt}
              onClick={() => setPhoto(opt)}
              label={
                opt === "none" ? (lang === "km" ? "គ្មាន" : "None") :
                opt === "morning" ? (lang === "km" ? "ព្រឹក" : "AM") :
                opt === "midday" ? (lang === "km" ? "ថ្ងៃត្រង់" : "Mid") :
                (lang === "km" ? "ល្ងាច" : "PM")
              }
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>{lang === "km" ? "ថ្ងៃចាប់ផ្តើម" : "Start date"}</Label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs outline-none" />
        </div>
        <div>
          <Label>{lang === "km" ? "រយៈពេល" : "Duration"}</Label>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={lang === "km" ? "៣ សប្តាហ៍" : "3 weeks"} className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs outline-none" />
        </div>
      </div>

      <button
        disabled={busy}
        onClick={() => onSubmit({
          agreedPrice: hasPrice && price ? Number(price) : null,
          checkinRequired: checkin,
          checkoutRequired: checkout,
          photoFrequency: photo === "none" ? null : photo,
          startDate: startDate || null,
          duration: duration || null,
        })}
        style={{ backgroundColor: "#0F6E56" }}
        className="flex h-10 w-full items-center justify-center rounded-lg text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? (lang === "km" ? "កំពុងផ្ញើ..." : "Sending...") : `${lang === "km" ? "ផ្ញើទៅ" : "Send to"} ${workerName}`}
      </button>
    </div>
  );
}

function PanelBtn({ onClick, disabled, color, icon, label }: { onClick: () => void; disabled?: boolean; color: string; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ backgroundColor: disabled ? undefined : color }}
      className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-bold disabled:bg-muted disabled:text-muted-foreground ${disabled ? "" : "text-white"}`}
    >
      {icon}{label}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-9 rounded-lg border text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`}>
      {label}
    </button>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange?.(i)} disabled={!onChange}>
          <Star className={`h-4 w-4 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function RateSheet({ name, onClose, onSubmit }: { name: string; onClose: () => void; onSubmit: (stars: number, comment: string | null) => Promise<void> }) {
  const { lang } = useI18n();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5">
        <div className="mb-2 text-base font-bold">{lang === "km" ? "វាយតម្លៃ" : "Rate"} {name}</div>
        <Stars value={stars} onChange={setStars} />
        <textarea
          value={comment}
          maxLength={100}
          onChange={(e) => setComment(e.target.value)}
          placeholder={lang === "km" ? "មតិយោបល់ (≤១០០តួ)" : "Comment (≤100 chars)"}
          className="mt-3 h-20 w-full rounded-xl border border-border bg-surface p-2 text-sm outline-none"
        />
        <div className="mt-3 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold">
            {lang === "km" ? "រំលង" : "Skip"}
          </button>
          <button
            onClick={async () => { setSubmitting(true); await onSubmit(stars, comment.trim() || null); setSubmitting(false); }}
            disabled={submitting}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {lang === "km" ? "ដាក់ស្នើ" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
