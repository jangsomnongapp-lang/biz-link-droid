import { createFileRoute, Link, useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/price";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  MoreHorizontal,
  Paperclip,
  Send,
  Mic,
  Image as ImageIcon,
  FileText,
  Square,
  Play,
  Pause,
  X,
} from "lucide-react";

export const Route = createFileRoute("/messages/$threadId")({
  validateSearch: (s: Record<string, unknown>): { project?: string; pin?: string } => ({
    project: typeof s.project === "string" ? s.project : undefined,
    pin: typeof s.pin === "string" ? s.pin : undefined,
  }),
  component: () => (
    <RequireAuth>
      <ConversationPage />
    </RequireAuth>
  ),
});

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}
interface OtherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}
interface PinnedProduct {
  id: string;
  kind: "post" | "rental" | "listing";
  href: string;
  title: string | null;
  content: string | null;
  price: number | null;
  discount_price: number | null;
  currency: string;
  post_type: string;
  photo_url: string | null;
}


// Attachment stored inside `content` as a JSON string prefixed with __ATT__:
type Attachment =
  | { kind: "image"; url: string; name?: string }
  | { kind: "audio"; url: string; duration?: number }
  | { kind: "file"; url: string; name: string; mime: string; size: number };

const ATT_PREFIX = "__ATT__:";
function encodeAttachment(a: Attachment) {
  return ATT_PREFIX + JSON.stringify(a);
}
function decodeAttachment(content: string): Attachment | null {
  if (!content.startsWith(ATT_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(ATT_PREFIX.length)) as Attachment;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function ConversationPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { threadId } = useParams({ from: "/messages/$threadId" });
  const { pin } = useSearch({ from: "/messages/$threadId" });
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [pinned, setPinned] = useState<PinnedProduct | null>(null);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: thread } = await supabase
        .from("message_threads")
        .select("participant_a, participant_b, pinned_post_id")
        .eq("id", threadId)
        .maybeSingle();
      if (!thread) return;
      const otherId = thread.participant_a === user.id ? thread.participant_b : thread.participant_a;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      setOther(profile);

      // Pin priority: explicit search param wins, otherwise fall back to thread.pinned_post_id (post only)
      const parsed = pin?.includes(":") ? (pin.split(":") as [string, string]) : null;
      const pinKind = parsed?.[0] as "post" | "rental" | "listing" | undefined;
      const pinId = parsed?.[1];

      if (pinKind === "rental" && pinId) {
        const { data: r } = await supabase
          .from("rental_listings")
          .select("id, title, description, price_per_day, currency, rental_photos(photo_url)")
          .eq("id", pinId)
          .maybeSingle();
        if (r) {
          const rr = r as unknown as { id: string; title: string | null; description: string | null; price_per_day: number | null; currency: string | null; rental_photos?: Array<{ photo_url: string }> };
          setPinned({
            id: rr.id,
            kind: "rental",
            href: `/rentals/${rr.id}`,
            title: rr.title,
            content: rr.description,
            price: rr.price_per_day,
            discount_price: null,
            currency: rr.currency ?? "USD",
            post_type: "rental",
            photo_url: rr.rental_photos?.[0]?.photo_url ?? null,
          });
        }
      } else if (pinKind === "listing" && pinId) {
        const { data: l } = await supabase
          .from("listings")
          .select("id, title, description, budget, listing_photos(photo_url)")
          .eq("id", pinId)
          .maybeSingle();
        if (l) {
          const ll = l as unknown as { id: string; title: string | null; description: string | null; budget: number | null; listing_photos?: Array<{ photo_url: string }> };
          setPinned({
            id: ll.id,
            kind: "listing",
            href: `/listings/${ll.id}`,
            title: ll.title,
            content: ll.description,
            price: ll.budget,
            discount_price: null,
            currency: "USD",
            post_type: "listing",
            photo_url: ll.listing_photos?.[0]?.photo_url ?? null,
          });
        }
      } else {
        const fallbackPostId = pinKind === "post" && pinId
          ? pinId
          : (thread as unknown as { pinned_post_id: string | null }).pinned_post_id;
        if (fallbackPostId) {
          const { data: post } = await supabase
            .from("posts")
            .select("id, title, content, price, discount_price, currency, post_type, post_photos(photo_url)")
            .eq("id", fallbackPostId)
            .maybeSingle();
          if (post) {
            const p = post as unknown as { id: string; title: string | null; content: string | null; price: number | null; discount_price: number | null; currency: string | null; post_type: string; post_photos?: Array<{ photo_url: string }> };
            setPinned({
              id: p.id,
              kind: "post",
              href: `/home?post=${p.id}`,
              title: p.title,
              content: p.content,
              price: p.price,
              discount_price: p.discount_price,
              currency: p.currency ?? "USD",
              post_type: p.post_type,
              photo_url: p.post_photos?.[0]?.photo_url ?? null,
            });
          }
        }
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      setMessages((msgs ?? []) as Message[]);

      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .neq("sender_id", user.id)
        .is("read_at", null);
    })();

    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((m) => [...m, payload.new as Message]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, threadId, pin]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function sendContent(content: string) {
    if (!user || !content) return;
    const { error } = await supabase
      .from("messages")
      .insert({ thread_id: threadId, sender_id: user.id, content });
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  }

  async function sendText() {
    if (!user || !text.trim()) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const ok = await sendContent(content);
    if (!ok) setText(content);
    setSending(false);
  }

  function fileToDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { validateImageFile } = await import("@/lib/upload-validation");
    if (!validateImageFile(file)) return;
    setSending(true);
    setShowAttach(false);
    try {
      const url = await fileToDataUrl(file);
      await sendContent(encodeAttachment({ kind: "image", url, name: file.name }));
    } finally {
      setSending(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ALLOWED_DOC_TYPES = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ];
    if (file.type && !ALLOWED_DOC_TYPES.includes(file.type)) {
      toast.error("Unsupported file type");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    setSending(true);
    setShowAttach(false);
    try {
      const url = await fileToDataUrl(file);
      await sendContent(
        encodeAttachment({
          kind: "file",
          url,
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
        }),
      );
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const duration = (Date.now() - recordStartRef.current) / 1000;
        // Cap voice messages: 2 MB and 2 minutes
        if (blob.size > 2 * 1024 * 1024) {
          toast.error("Voice message too large (max 2 MB)");
          return;
        }
        if (duration > 120) {
          toast.error("Voice message too long (max 2 minutes)");
          return;
        }
        setSending(true);
        try {
          const url = await fileToDataUrl(blob);
          await sendContent(encodeAttachment({ kind: "audio", url, duration }));
        } finally {
          setSending(false);
        }
      };
      mediaRecorderRef.current = mr;
      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000));
      }, 200);
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording(send: boolean) {
    const mr = mediaRecorderRef.current;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    if (!mr) {
      setRecording(false);
      return;
    }
    if (!send) {
      mr.ondataavailable = null;
      mr.onstop = () => mr.stream.getTracks().forEach((tr) => tr.stop());
    }
    if (mr.state !== "inactive") mr.stop();
    setRecording(false);
    setRecordSeconds(0);
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-primary px-2 text-primary-foreground">
        <Link to="/messages" className="rounded-full p-2 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {other?.id ? (
          <Link
            to="/users/$userId"
            params={{ userId: other.id }}
            className="flex flex-1 min-w-0 items-center gap-2 rounded-lg p-1 -m-1 active:bg-white/10"
          >
            <Avatar name={other?.full_name} url={other?.avatar_url} size={36} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-semibold">{other?.full_name ?? "—"}</div>
              <div className="text-[11px] text-white/80">{t("online")}</div>
            </div>
          </Link>
        ) : (
          <div className="flex flex-1 min-w-0 items-center gap-2">
            <Avatar name={other?.full_name} url={other?.avatar_url} size={36} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-semibold">{other?.full_name ?? "—"}</div>
              <div className="text-[11px] text-white/80">{t("online")}</div>
            </div>
          </div>
        )}
        <button className="rounded-full p-2 active:bg-white/10" aria-label="More">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      




      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        <div className="mx-auto w-fit rounded-pill bg-muted px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
          {t("today")}
        </div>
        {pinned && (
          <div className="flex justify-end">
            <div className="flex max-w-[78%] flex-col items-end gap-1">
              <a
                href={pinned.href}
                className="flex w-56 items-center gap-2 rounded-2xl border border-border bg-muted/40 p-2 active:opacity-70"
              >
                {pinned.photo_url ? (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    <img src={pinned.photo_url} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-foreground">
                    {pinned.title || pinned.content?.split("\n")[0] || "Item"}
                  </p>
                  {pinned.price != null && (
                    <p className="text-[10px] font-bold text-success">
                      {formatPrice(pinned.discount_price ?? pinned.price, pinned.currency)}
                      {pinned.kind === "rental" && (
                        <span className="ml-1 font-normal text-muted-foreground">/day</span>
                      )}
                    </p>
                  )}
                </div>
              </a>
              <span className="pr-1 text-[10px] text-muted-foreground">
                Replying about this {pinned.kind === "rental" ? "rental" : pinned.kind === "listing" ? "job" : "post"}
              </span>
            </div>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const att = decodeAttachment(m.content);
          if (m.content.startsWith("[material_request] ")) {
            return (
              <div key={m.id} className="mx-auto max-w-[90%] rounded-xl border-2 border-[#c87000] bg-[#c87000]/10 px-3 py-2 text-center text-xs font-semibold text-[#c87000]">
                📦 {m.content.replace("[material_request] ", "")}
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-surface text-foreground shadow-card"
                }`}
              >
                {att ? (
                  <AttachmentView att={att} mine={mine} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
                <div
                  className={`mt-0.5 text-right text-[10px] ${
                    mine ? "text-white/75" : "text-muted-foreground"
                  }`}
                >
                  {time}
                  {mine && (m.read_at ? " ✓✓" : " ✓")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Attach sheet */}
      {showAttach && !recording && (
        <div className="border-t border-border bg-surface px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm font-medium active:scale-[0.98]"
            >
              <ImageIcon className="h-5 w-5 text-primary" />
              Photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm font-medium active:scale-[0.98]"
            >
              <FileText className="h-5 w-5 text-primary" />
              Document
            </button>
          </div>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickImage}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf"
        className="hidden"
        onChange={onPickFile}
      />

      {pinned && (
        <PinnedReplyCard
          p={pinned}
          onClear={() => {
            setPinned(null);
            void navigate({
              to: "/messages/$threadId",
              params: { threadId },
              search: (prev: Record<string, unknown>) => ({ ...prev, pin: undefined }),
              replace: true,
            });
          }}
        />
      )}

      <div className="border-t border-border bg-surface p-2">
        {recording ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => stopRecording(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-destructive active:scale-95"
              aria-label="Cancel"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-10 flex-1 items-center gap-2 rounded-pill bg-destructive/10 px-4 text-sm font-medium text-destructive">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
              Recording… {formatDuration(recordSeconds)}
            </div>
            <button
              onClick={() => stopRecording(true)}
              disabled={sending}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-50"
              aria-label="Send voice"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAttach((v) => !v)}
              className={`rounded-full p-2 active:bg-muted ${showAttach ? "text-primary" : "text-muted-foreground"}`}
              aria-label="Attach"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendText();
                }
              }}
              placeholder={t("write_message")}
              className="h-10 flex-1 rounded-pill bg-background px-4 text-sm outline-none"
            />
            {text.trim() ? (
              <button
                onClick={() => void sendText()}
                disabled={sending}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-50"
                aria-label={t("send")}
              >
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => void startRecording()}
                disabled={sending}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-50"
                aria-label="Record voice"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const PIN_TYPE_LABELS: Record<string, { en: string; km: string; bg: string; fg: string }> = {
  novedad:     { en: "New",       km: "ថ្មី",        bg: "bg-emerald-100", fg: "text-emerald-700" },
  stock:       { en: "Stock",     km: "ស្តុក",       bg: "bg-sky-100",     fg: "text-sky-700" },
  oferta:      { en: "Offer",     km: "ការផ្តល់ជូន",  bg: "bg-amber-100",   fg: "text-amber-700" },
  liquidacion: { en: "Clearance", km: "បោះតម្លៃ",    bg: "bg-rose-100",    fg: "text-rose-700" },
};

function PinnedProductBanner({ p }: { p: PinnedProduct }) {
  const meta = PIN_TYPE_LABELS[p.post_type];
  const heading = p.title || p.content?.split("\n")[0] || "Product";
  return (
    <div className="sticky top-14 z-10 border-b border-amber-300 bg-amber-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-amber-700">📌</span>
        {p.photo_url && (
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
            <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            {meta && (
              <span className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.fg}`}>
                {meta.en}
              </span>
            )}
            <p className="truncate text-xs font-semibold text-foreground">{heading}</p>
          </div>
          {p.price != null && (
            <p className="text-[11px] font-bold">
              {p.discount_price != null ? (
                <>
                  <span className="text-rose-600">{formatPrice(p.discount_price, p.currency)}</span>
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground line-through">{formatPrice(p.price, p.currency)}</span>
                </>
              ) : (
                <span className="text-success">{formatPrice(p.price, p.currency)}</span>
              )}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

function PinnedReplyCard({ p, onClear }: { p: PinnedProduct; onClear: () => void }) {
  const heading = p.title || p.content?.split("\n")[0] || "Item";
  const kindLabel = p.kind === "rental" ? "rental" : p.kind === "listing" ? "job" : "post";
  return (
    <div className="border-t border-border bg-muted/40 px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Replying about this {kindLabel}</span>
        <button
          onClick={onClear}
          className="rounded-full p-1 active:bg-muted"
          aria-label="Remove pin"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <a
        href={p.href}
        className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2 active:opacity-70"
      >
        {p.photo_url ? (
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
            <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-md bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{heading}</p>
          {p.price != null && (
            <p className="text-[11px] font-bold">
              {p.discount_price != null ? (
                <>
                  <span className="text-rose-600">{formatPrice(p.discount_price, p.currency)}</span>
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground line-through">{formatPrice(p.price, p.currency)}</span>
                </>
              ) : (
                <span className="text-success">{formatPrice(p.price, p.currency)}</span>
              )}
              {p.kind === "rental" && <span className="ml-1 text-[10px] font-normal text-muted-foreground">/day</span>}
            </p>
          )}
        </div>
      </a>
    </div>
  );
}


function isSafeUrl(url: string): boolean {
  if (typeof url !== "string") return false;
  return (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("data:image/") ||
    url.startsWith("data:audio/") ||
    url.startsWith("data:application/pdf") ||
    url.startsWith("data:application/msword") ||
    url.startsWith("data:application/vnd.") ||
    url.startsWith("data:text/plain")
  );
}

function AttachmentView({ att, mine }: { att: Attachment; mine: boolean }) {
  if (!isSafeUrl(att.url)) {
    return (
      <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
        Unsupported attachment
      </div>
    );
  }
  if (att.kind === "image") {
    return (
      <a href={att.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={att.url}
          alt={att.name ?? "image"}
          className="max-h-72 w-full rounded-lg object-cover"
        />
      </a>
    );
  }
  if (att.kind === "audio") {
    return <VoicePlayer url={att.url} duration={att.duration} mine={mine} />;
  }
  return (
    <a
      href={att.url}
      download={att.name}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-lg p-2 ${
        mine ? "bg-white/15" : "bg-muted"
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-md ${mine ? "bg-white/20" : "bg-primary/10"}`}>
        <FileText className={`h-5 w-5 ${mine ? "text-white" : "text-primary"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{att.name}</div>
        <div className={`text-[11px] ${mine ? "text-white/75" : "text-muted-foreground"}`}>
          {formatBytes(att.size)}
        </div>
      </div>
    </a>
  );
}

function VoicePlayer({ url, duration, mine }: { url: string; duration?: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(duration ?? 0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime);
    const onMeta = () => {
      if (isFinite(a.duration)) setDur(a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  };

  const pct = dur > 0 ? Math.min(100, (progress / dur) * 100) : 0;

  return (
    <div className="flex min-w-[180px] items-center gap-2">
      <button
        onClick={toggle}
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          mine ? "bg-white/20 text-white" : "bg-primary text-primary-foreground"
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className={`h-1 w-full rounded-full ${mine ? "bg-white/25" : "bg-muted"}`}>
          <div
            className={`h-full rounded-full ${mine ? "bg-white" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={`mt-1 text-[10px] ${mine ? "text-white/75" : "text-muted-foreground"}`}>
          {formatDuration(playing || progress > 0 ? progress : dur)}
        </div>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}
