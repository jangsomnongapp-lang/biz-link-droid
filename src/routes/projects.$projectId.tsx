import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  respondToProject,
  requestCompletion,
  cancelCompletion,
  confirmCompletion,
  submitRating,
  configureProject,
} from "@/lib/projects.functions";
import { ArrowLeft, Camera, CheckCircle2, Clock, Send, Star, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/projects/$projectId")({
  component: () => (
    <RequireAuth>
      <ProjectSpacePage />
    </RequireAuth>
  ),
});

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
interface PartProfile { id: string; full_name: string | null; avatar_url: string | null }
interface LogRow { id: string; user_id: string; log_type: "checkin" | "checkout" | "photo"; photo_url: string | null; created_at: string }
interface Msg { id: string; sender_id: string; content: string; created_at: string }
interface RatingRow { id: string; rater_id: string; rated_id: string; stars: number; comment: string | null }

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

function ProjectSpacePage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const [project, setProject] = useState<Project | null>(null);
  const [owner, setOwner] = useState<PartProfile | null>(null);
  const [worker, setWorker] = useState<PartProfile | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const respondFn = useServerFn(respondToProject);
  const requestFn = useServerFn(requestCompletion);
  const cancelFn = useServerFn(cancelCompletion);
  const confirmFn = useServerFn(confirmCompletion);
  const rateFn = useServerFn(submitRating);
  const configureFn = useServerFn(configureProject);

  // Loaders
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: p } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (cancelled) return;
      if (!p) { setProject(null); return; }
      setProject(p as Project);
      const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", [p.owner_id, p.worker_id]);
      const map = Object.fromEntries((profs ?? []).map((x) => [x.id, x as PartProfile]));
      setOwner(map[p.owner_id] ?? null);
      setWorker(map[p.worker_id] ?? null);
      const { data: l } = await supabase.from("project_logs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50);
      setLogs((l ?? []) as LogRow[]);
      const { data: m } = await supabase.from("project_messages").select("*").eq("project_id", projectId).order("created_at").limit(200);
      setMessages((m ?? []) as Msg[]);
      const { data: r } = await supabase.from("project_ratings").select("id, rater_id, rated_id, stars, comment").eq("project_id", projectId);
      setRatings((r ?? []) as RatingRow[]);
    }
    void load();

    const channel = supabase
      .channel(`project-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `id=eq.${projectId}` }, (payload) => {
        if (payload.new) setProject(payload.new as Project);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Msg]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_logs", filter: `project_id=eq.${projectId}` }, (payload) => {
        setLogs((prev) => [payload.new as LogRow, ...prev]);
      })
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [projectId]);

  if (!project) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{lang === "km" ? "កំពុងផ្ទុក..." : "Loading..."}</div>;
  }

  const isOwner = user?.id === project.owner_id;
  const isWorker = user?.id === project.worker_id;
  const me = isOwner ? "owner" : isWorker ? "worker" : "none";
  const other = isOwner ? worker : owner;
  const myRating = ratings.find((r) => r.rater_id === user?.id);
  const otherRating = ratings.find((r) => r.rater_id === (isOwner ? project.worker_id : project.owner_id));

  // === STEP 3 — Pending request (worker view)
  if (project.status === "pending") {
    if (me === "worker") {
      return <PendingWorkerView project={project} owner={owner} onRespond={async (accept) => {
        if (busy) return;
        setBusy(true);
        try {
          await respondFn({ headers: await authHeaders(), data: { projectId, accept } });
          toast.success(accept ? (lang === "km" ? "បានទទួលយក" : "Accepted") : (lang === "km" ? "បានបដិសេធ" : "Declined"));
        } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
      }} busy={busy} />;
    }
    return (
      <Frame title={lang === "km" ? "កំពុងរង់ចាំ" : "Awaiting response"}>
        <div className="p-6 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {lang === "km" ? "កំពុងរង់ចាំ" : "Waiting for"} <strong>{worker?.full_name ?? "—"}</strong> {lang === "km" ? "ឆ្លើយតប" : "to respond"}
          </p>
        </div>
      </Frame>
    );
  }

  if (project.status === "declined") {
    return (
      <Frame title={lang === "km" ? "បានបដិសេធ" : "Declined"}>
        <div className="p-6 text-center text-sm text-muted-foreground">
          {lang === "km" ? "សំណើគម្រោងត្រូវបានបដិសេធ។" : "This project request was declined."}
        </div>
      </Frame>
    );
  }

  // === STEP 4 / 5 — Active or Completed: project space + chat
  const today = new Date().toDateString();
  const myLogsToday = logs.filter((l) => l.user_id === user?.id && new Date(l.created_at).toDateString() === today);
  const checkedInToday = myLogsToday.some((l) => l.log_type === "checkin");
  const checkedOutToday = myLogsToday.some((l) => l.log_type === "checkout");
  const photosToday = myLogsToday.filter((l) => l.log_type === "photo").length;
  const latestPhoto = logs.find((l) => l.log_type === "photo");
  const checkinsCount = logs.filter((l) => l.log_type === "checkin").length;
  const photosCount = logs.filter((l) => l.log_type === "photo").length;
  const daysActive = Math.max(1, Math.ceil((Date.now() - new Date(project.created_at).getTime()) / 86400000));

  async function recordLog(type: "checkin" | "checkout") {
    if (!user) return;
    const { error } = await supabase.from("project_logs").insert({ project_id: projectId, user_id: user.id, log_type: type });
    if (error) toast.error(error.message);
  }

  async function uploadPhoto(file: File) {
    if (!user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${projectId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("project-photos").upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("project-photos").getPublicUrl(path);
    const { error } = await supabase.from("project_logs").insert({
      project_id: projectId, user_id: user.id, log_type: "photo", photo_url: pub.publicUrl,
    });
    if (error) toast.error(error.message);
    else toast.success(lang === "km" ? "បានផ្ទុកឡើង" : "Uploaded");
  }

  async function sendMessage() {
    if (!user || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    const { error } = await supabase.from("project_messages").insert({ project_id: projectId, sender_id: user.id, content });
    if (error) toast.error(error.message);
  }

  async function onMarkComplete() {
    if (busy) return;
    setBusy(true);
    try {
      await requestFn({ headers: await authHeaders(), data: { projectId } });
      toast.success(lang === "km" ? "បានស្នើបញ្ចប់" : "Completion requested");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  }
  async function onConfirmComplete() {
    if (busy) return;
    setBusy(true);
    try {
      await confirmFn({ headers: await authHeaders(), data: { projectId } });
      toast.success(lang === "km" ? "គម្រោងបានបញ្ចប់" : "Project completed");
      setShowRate(true);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  }
  async function onRejectComplete() {
    setBusy(true);
    try { await cancelFn({ headers: await authHeaders(), data: { projectId } }); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  }

  const completionRequestedByOther = !!project.completion_requested_by && project.completion_requested_by !== user?.id;
  const completionRequestedByMe = project.completion_requested_by === user?.id;

  // === Owner setup screen — full-screen takeover after worker accepts
  if (project.status === "active" && !project.setup_completed && me === "owner") {
    return (
      <SetupScreen
        worker={worker}
        busy={busy}
        onBack={() => nav({ to: "/home" })}
        onSubmit={async (vals) => {
          if (busy) return;
          setBusy(true);
          try {
            await configureFn({ headers: await authHeaders(), data: { projectId, ...vals } });
            toast.success(lang === "km" ? "បានចាប់ផ្តើម" : "Project started");
          } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <button onClick={() => nav({ to: "/home" })} className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-2">
          <Avatar name={other?.full_name} url={other?.avatar_url} size={28} />
          <div className="text-sm font-semibold">{other?.full_name ?? "—"}</div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            project.status === "completed" ? "bg-white/20" : "bg-emerald-500"
          }`}>
            {project.status === "completed"
              ? (lang === "km" ? "បានបញ្ចប់" : "Completed")
              : (lang === "km" ? "សកម្ម" : "Active")}
          </span>
        </div>
        <span className="w-9" />
      </header>

      <div className="flex-1 space-y-3 px-3 pb-44 pt-3">
        {/* Project info card */}
        <Card>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{lang === "km" ? "ព័ត៌មានគម្រោង" : "Project info"}</span>
            <span>{lang === "km" ? "ថ្ងៃ" : "Day"} {daysActive}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
            {project.agreed_price != null && (<><Field>{lang === "km" ? "តម្លៃ" : "Price"}</Field><Value>${project.agreed_price}</Value></>)}
            {project.start_date && (<><Field>{lang === "km" ? "ចាប់ផ្តើម" : "Start"}</Field><Value>{project.start_date}</Value></>)}
            {project.duration && (<><Field>{lang === "km" ? "រយៈពេល" : "Duration"}</Field><Value>{project.duration}</Value></>)}
          </div>
        </Card>

        {/* Completion banner */}
        {project.status === "active" && completionRequestedByOther && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              <strong>{other?.full_name}</strong> {lang === "km" ? "និយាយថាគម្រោងនេះបានបញ្ចប់។ តើពិតមែនទេ?" : "says the project is finished. Do you confirm?"}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onRejectComplete}
                disabled={busy}
                className="flex-1 rounded-xl border border-rose-300 bg-rose-50 py-2.5 text-sm font-semibold text-rose-800 active:scale-[0.99]"
              >
                {lang === "km" ? "មិនទាន់" : "No"}
              </button>
              <button
                onClick={onConfirmComplete}
                disabled={busy}
                style={{ backgroundColor: "#0F6E56" }}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
              >
                {lang === "km" ? "បាទ បញ្ជាក់" : "Yes, confirm"}
              </button>
            </div>
          </div>
        )}
        {project.status === "active" && completionRequestedByMe && (
          <div className="rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
            {lang === "km" ? "កំពុងរង់ចាំការបញ្ជាក់ពីភាគីម្ខាងទៀត..." : "Waiting for the other party to confirm completion..."}
          </div>
        )}

        {/* Owner setup is handled by full-screen takeover above */}
        {project.status === "active" && !project.setup_completed && me === "worker" && (
          <Card>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {lang === "km"
                ? `កំពុងរង់ចាំ ${owner?.full_name ?? "—"} កំណត់លក្ខខណ្ឌគម្រោង...`
                : `Waiting for ${owner?.full_name ?? "—"} to set up the project details...`}
            </div>
          </Card>
        )}

        {/* Worker / Owner panels (active and configured) */}
        {project.status === "active" && project.setup_completed && me === "worker" && (
          <div className="space-y-2">
            {project.checkin_required && (
              <BigButton
                onClick={() => recordLog("checkin")}
                disabled={checkedInToday}
                color="#0F6E56"
                icon={<LogIn className="h-6 w-6" />}
                label={checkedInToday ? (lang === "km" ? "បានចូលថ្ងៃនេះ" : "Checked in today") : (lang === "km" ? "ចុចចូល" : "Check in")}
              />
            )}
            {project.checkout_required && (
              <BigButton
                onClick={() => recordLog("checkout")}
                disabled={checkedOutToday || (project.checkin_required && !checkedInToday)}
                color="#1e40af"
                icon={<LogOut className="h-6 w-6" />}
                label={checkedOutToday ? (lang === "km" ? "បានចេញថ្ងៃនេះ" : "Checked out today") : (lang === "km" ? "ចុចចេញ" : "Check out")}
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
                <BigButton
                  onClick={() => fileInput.current?.click()}
                  color="#475569"
                  icon={<Camera className="h-6 w-6" />}
                  label={`${lang === "km" ? "រូបភាព" : "Progress photo"} (${photosToday} ${lang === "km" ? "ថ្ងៃនេះ" : "today"})`}
                />
              </>
            )}
          </div>
        )}

        {project.status === "active" && project.setup_completed && me === "owner" && (latestPhoto || project.checkin_required || project.photo_frequency) && (
          <Card>
            <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "km" ? "សកម្មភាពថ្មីៗ" : "Latest activity"}</div>
            {latestPhoto && (
              <div className="mt-2 overflow-hidden rounded-lg bg-muted">
                <img src={latestPhoto.photo_url ?? ""} alt="" className="aspect-video w-full object-cover" />
              </div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={daysActive} l={lang === "km" ? "ថ្ងៃ" : "Days"} />
              <Stat n={checkinsCount} l={lang === "km" ? "ចូល" : "Check-ins"} />
              <Stat n={photosCount} l={lang === "km" ? "រូបភាព" : "Photos"} />
            </div>
          </Card>
        )}

        {/* Today's log */}
        {logs.length > 0 && (
          <Card>
            <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "km" ? "កំណត់ហេតុ" : "Activity log"}</div>
            <ul className="mt-2 space-y-1.5 text-xs">
              {logs.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${l.log_type === "checkin" ? "bg-emerald-500" : l.log_type === "checkout" ? "bg-blue-500" : "bg-slate-500"}`} />
                  <span className="capitalize text-foreground">{l.log_type}</span>
                  <span className="text-muted-foreground">· {new Date(l.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Mini chat */}
        <Card>
          <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "km" ? "សន្ទនា" : "Chat"}</div>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {messages.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">{lang === "km" ? "មិនទាន់មានសារ" : "No messages yet"}</div>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Ratings (after completion) */}
        {project.status === "completed" && (
          <Card>
            <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "km" ? "ការវាយតម្លៃ" : "Ratings"}</div>
            {myRating ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span>{lang === "km" ? "អ្នកបានវាយតម្លៃ" : "You rated"}:</span>
                <Stars value={myRating.stars} />
              </div>
            ) : (
              <button
                onClick={() => setShowRate(true)}
                className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99]"
              >
                {lang === "km" ? "វាយតម្លៃឥឡូវនេះ" : "Rate now"}
              </button>
            )}
            {otherRating && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span>{other?.full_name ?? "—"}:</span>
                <Stars value={otherRating.stars} />
                {otherRating.comment && <span className="text-muted-foreground">— {otherRating.comment}</span>}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Bottom: chat input + complete button */}
      <div className="sticky bottom-0 space-y-2 border-t border-border bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void sendMessage(); }}
            placeholder={lang === "km" ? "សរសេរសារ..." : "Write a message..."}
            className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none"
          />
          <button
            onClick={sendMessage}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {project.status === "active" && project.setup_completed && !completionRequestedByOther && !completionRequestedByMe && (
          <button
            onClick={onMarkComplete}
            disabled={busy}
            style={{ backgroundColor: "#0F6E56" }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {lang === "km" ? "សម្គាល់ថាបានបញ្ចប់" : "Mark as completed"}
          </button>
        )}
      </div>

      {showRate && project.status === "completed" && !myRating && (
        <RateSheet
          name={other?.full_name ?? "—"}
          onClose={() => setShowRate(false)}
          onSubmit={async (stars, comment) => {
            try {
              await rateFn({ headers: await authHeaders(), data: { projectId, stars, comment } });
              const { data: r } = await supabase.from("project_ratings").select("id, rater_id, rated_id, stars, comment").eq("project_id", projectId);
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

function PendingWorkerView({
  project, owner, onRespond, busy,
}: { project: Project; owner: PartProfile | null; onRespond: (a: boolean) => void | Promise<void>; busy: boolean }) {
  const { lang } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/alerts" className="rounded-full p-2 active:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-center text-base font-semibold">{lang === "km" ? "សំណើគម្រោង" : "Project request"}</h1>
        <span className="w-9" />
      </header>

      <div className="flex-1 space-y-3 p-3 pb-32">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <Avatar name={owner?.full_name} url={owner?.avatar_url} size={48} />
          <div>
            <div className="text-sm font-bold">{owner?.full_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{lang === "km" ? "ចង់ចាប់ផ្តើមគម្រោងជាមួយអ្នក" : "wants to start a project with you"}</div>
          </div>
        </div>

        <Card>
          <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "km" ? "សង្ខេបគម្រោង" : "Project summary"}</div>
          <div className="mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
            {project.agreed_price != null && (<><Field>{lang === "km" ? "តម្លៃ" : "Agreed price"}</Field><Value>${project.agreed_price}</Value></>)}
            {project.start_date && (<><Field>{lang === "km" ? "ថ្ងៃចាប់ផ្តើម" : "Start date"}</Field><Value>{project.start_date}</Value></>)}
            {project.duration && (<><Field>{lang === "km" ? "រយៈពេល" : "Duration"}</Field><Value>{project.duration}</Value></>)}
            {(project.checkin_required || project.checkout_required || project.photo_frequency) && (
              <>
                <Field>{lang === "km" ? "តម្រូវការ" : "Requirements"}</Field>
                <div className="flex flex-wrap gap-1">
                  {project.checkin_required && <Tag>{lang === "km" ? "ចូល" : "Check-in"}</Tag>}
                  {project.checkout_required && <Tag>{lang === "km" ? "ចេញ" : "Check-out"}</Tag>}
                  {project.photo_frequency && <Tag>{project.photo_frequency} {lang === "km" ? "រូបថត" : "photo"}</Tag>}
                </div>
              </>
            )}
          </div>
          {project.agreed_price == null && !project.start_date && !project.duration &&
            !project.checkin_required && !project.checkout_required && !project.photo_frequency && (
            <p className="mt-2 text-xs text-muted-foreground">{lang === "km" ? "មិនមានលក្ខខណ្ឌជាក់លាក់" : "No specific conditions set"}</p>
          )}
        </Card>

        <p className="px-2 text-center text-xs text-muted-foreground">
          {lang === "km"
            ? `ពិនិត្យដោយប្រុងប្រយ័ត្ន — អ្នក និង ${owner?.full_name ?? "—"} គួរតែបានពិភាក្សាលក្ខខណ្ឌទាំងនេះរួចហើយ`
            : `Review carefully — you and ${owner?.full_name ?? "—"} should have discussed these conditions already`}
        </p>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-white p-3">
        <div className="flex gap-2">
          <button
            onClick={() => onRespond(false)}
            disabled={busy}
            className="flex-1 rounded-xl border border-rose-300 bg-rose-50 py-3 text-sm font-semibold text-rose-800 active:scale-[0.99]"
          >
            {lang === "km" ? "បដិសេធ" : "Decline"}
          </button>
          <button
            onClick={() => onRespond(true)}
            disabled={busy}
            style={{ backgroundColor: "#0F6E56" }}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-white active:scale-[0.99]"
          >
            {lang === "km" ? "ទទួលយក" : "Accept project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <Link to="/home" className="rounded-full p-2 active:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-center text-base font-semibold">{title}</h1>
        <span className="w-9" />
      </header>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">{children}</div>;
}
function Field({ children }: { children: React.ReactNode }) { return <div className="text-xs text-muted-foreground">{children}</div>; }
function Value({ children }: { children: React.ReactNode }) { return <div className="text-right text-sm font-semibold">{children}</div>; }
function Tag({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{children}</span>; }
function Stat({ n, l }: { n: number; l: string }) { return <div><div className="text-lg font-bold text-primary">{n}</div><div className="text-[10px] text-muted-foreground">{l}</div></div>; }
function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange?.(i)} disabled={!onChange}>
          <Star className={`h-6 w-6 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}
function BigButton({ onClick, disabled, color, icon, label }: { onClick: () => void; disabled?: boolean; color: string; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ backgroundColor: disabled ? undefined : color }}
      className={`flex h-20 w-full flex-col items-center justify-center gap-1 rounded-xl text-sm font-bold active:scale-[0.99] disabled:bg-muted disabled:text-muted-foreground ${disabled ? "" : "text-white"}`}
    >
      {icon}{label}
    </button>
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
          placeholder={lang === "km" ? "មតិយោបល់ (ស្រេចចិត្ត, ≤១០០តួ)" : "Comment (optional, ≤100 chars)"}
          className="mt-3 h-20 w-full rounded-xl border border-border bg-surface p-2 text-sm outline-none"
        />
        <div className="mt-1 text-right text-[10px] text-muted-foreground">{comment.length}/100</div>
        <div className="mt-3 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold">
            {lang === "km" ? "រំលង" : "Skip"}
          </button>
          <button
            onClick={async () => { setSubmitting(true); await onSubmit(stars, comment.trim() || null); setSubmitting(false); }}
            disabled={submitting}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {lang === "km" ? "ដាក់ស្នើ" : "Submit ratings"}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {lang === "km" ? "ការវាយតម្លៃជាសាធារណៈនៅលើទម្រង់ទាំងពីរ" : "Ratings are public on both profiles"}
        </p>
      </div>
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

function SetupScreen({
  worker, busy, onBack, onSubmit,
}: { worker: PartProfile | null; busy: boolean; onBack: () => void; onSubmit: (vals: SetupValues) => Promise<void> }) {
  const { lang } = useI18n();
  const [hasPrice, setHasPrice] = useState(false);
  const [price, setPrice] = useState<string>("");
  const [checkin, setCheckin] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [photo, setPhoto] = useState<"none" | "morning" | "midday" | "endofday">("none");
  const [startDate, setStartDate] = useState<string>("");
  const [duration, setDuration] = useState<string>("");

  const workerName = worker?.full_name ?? "—";

  return (
    <div className="flex min-h-screen flex-col bg-white text-foreground">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-primary px-2 text-primary-foreground">
        <button onClick={onBack} className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold">
          {lang === "km" ? "ចាប់ផ្តើមគម្រោង" : "Start a project"}
        </h1>
        <span className="w-9" />
      </header>

      <div className="flex-1 space-y-5 p-4 pb-32">
        <div>
          <SLabel>{lang === "km" ? "ជ្រើសរើសកម្មករ" : "Selected worker"}</SLabel>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <Avatar name={worker?.full_name} url={worker?.avatar_url} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{workerName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {lang === "km" ? "បានទទួលយក" : "Accepted your request"}
              </div>
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
          disabled={busy}
          onClick={() =>
            onSubmit({
              agreedPrice: hasPrice && price ? Number(price) : null,
              checkinRequired: checkin,
              checkoutRequired: checkout,
              photoFrequency: photo === "none" ? null : photo,
              startDate: startDate || null,
              duration: duration || null,
            })
          }
          style={{ backgroundColor: "#0F6E56" }}
          className="flex h-14 w-full flex-col items-center justify-center rounded-xl text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
        >
          <span>{busy ? (lang === "km" ? "កំពុងផ្ញើ..." : "Sending...") : `${lang === "km" ? "ផ្ញើទៅ" : "Send to"} ${workerName}`}</span>
          <span className="text-[11px] font-normal opacity-90">
            {lang === "km" ? "ចាប់ផ្តើមគម្រោង" : "Start the project"}
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
