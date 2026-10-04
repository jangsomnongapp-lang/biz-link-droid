import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { CommentsSheet } from "@/components/CommentsSheet";
import { RentalCommentsSheet } from "@/components/RentalCommentsSheet";
import { ReportMenu } from "@/components/ReportMenu";
import { OwnerMenu } from "@/components/OwnerMenu";
import { EditTextDialog } from "@/components/EditTextDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { ReactionButton, reactionMeta, type ReactionId } from "@/components/ReactionButton";

/** Most-used reactions first, up to 3 — used for the Facebook-style emoji stack. */
function topReactions(counts: Record<string, number>): ReactionId[] {
  return (Object.entries(counts) as [ReactionId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);
}
import { Plus, ThumbsUp, MessageSquare, Share2, SquarePen, X, BadgeCheck, Briefcase, Sparkles, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, Play, HardHat, Boxes, Search, BriefcaseBusiness, Gift } from "lucide-react";

/** Materials icon — user-supplied SVG (stacked blocks), white filled paths. */
function MaterialsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path fill="currentColor" d="M233.986 85.262l-63.37 21.11L334.32 160.9l63.373-21.11-163.707-54.53zm-82.85 33.593v58.088l174.184 58.02v-58.086l-174.183-58.022zm-18 50.215l-53.71 17.89 162.63 54.175 22.417-7.467-125.18-41.7a9 9 0 0 1-6.156-8.536V169.07zm-73.19 30.375v58.088l122.286 40.733v-30.71a9 9 0 0 1 .018-.357 9 9 0 0 1 .01-.192 9 9 0 0 1 .07-.697 9 9 0 0 1 .03-.205 9 9 0 0 1 .134-.66 9 9 0 0 1 .06-.236 9 9 0 0 1 .19-.616 9 9 0 0 1 .092-.248 9 9 0 0 1 .238-.567 9 9 0 0 1 .135-.282 9 9 0 0 1 .265-.488 9 9 0 0 1 .197-.32 9 9 0 0 1 .28-.41 9 9 0 0 1 .26-.342 9 9 0 0 1 .288-.344 9 9 0 0 1 .318-.342 9 9 0 0 1 .3-.29 9 9 0 0 1 .374-.33 9 9 0 0 1 .3-.237 9 9 0 0 1 .438-.315 9 9 0 0 1 .286-.182 9 9 0 0 1 .502-.29 9 9 0 0 1 .26-.133 9 9 0 0 1 .59-.262 9 9 0 0 1 .21-.082 9 9 0 0 1 .317-.122l25.18-8.387-153.628-51.175zm364.847 27.352l-87.63 29.19a9 9 0 0 1-.247.07 9 9 0 0 1-.355.1 9 9 0 0 1-.443.1 9 9 0 0 1-.47.085 9 9 0 0 1-.4.05 9 9 0 0 1-.49.038 9 9 0 0 1-.423.007 9 9 0 0 1-.48-.01 9 9 0 0 1-.397-.03 9 9 0 0 1-.504-.06 9 9 0 0 1-.38-.07 9 9 0 0 1-.52-.117 9 9 0 0 1-.31-.087 9 9 0 0 1-.268-.077l-38.526-12.834-73.23 24.395 63.368 21.11 163.707-54.532-22.002-7.328zm-224.56 53.242v58.085l73.85 24.602v-36.225l.005.002V304.63l-2.752-.915-.014.004-71.09-23.68zm-85.174 14.82L58.57 313.68l63.373 21.11 56.485-18.817-63.37-21.11zM39.095 326.17v58.088l73.85 24.6v-58.088l-73.85-24.6zm390.207 9.816l-63.375 21.112 36.283 12.086 63.374-21.112-36.28-12.086zM219.03 363.36v21.86l174.183 58.022v-58.088L337.45 366.58l-51.516 17.162a9 9 0 0 1-.19.053 9 9 0 0 1-.467.133 9 9 0 0 1-.332.074 9 9 0 0 1-.588.107 9 9 0 0 1-.253.03 9 9 0 0 1-.674.053 9 9 0 0 1-.196.004 9 9 0 0 1-.693-.013 9 9 0 0 1-.206-.016 9 9 0 0 1-.723-.09 9 9 0 0 1-.122-.02 9 9 0 0 1-.795-.18 9 9 0 0 1-.025-.007 9 9 0 0 1-.432-.122l-61.207-20.39z" />
    </svg>
  );
}

/** Machinery & Tools icon — user-supplied SVG (excavator on tracks), white filled paths. */
function MachineryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M29.2948 17H31.051L31.4434 24.0637C31.5037 25.15 32.4022 26 33.4902 26H40.051L40.3287 31H19.0571L19.3102 26.4453C19.6046 21.1461 23.9874 17 29.2948 17ZM17.3132 26.3344C17.6665 19.9754 22.926 15 29.2948 15H31.051C32.1124 15 32.989 15.8292 33.0479 16.8891L33.4403 23.9528C33.4418 23.9793 33.4637 24 33.4902 24H40.524C41.3201 24 41.9775 24.6219 42.0216 25.4168L42.4136 32.4723C42.4295 32.7589 42.2014 33 41.9144 33H18C17.4259 33 16.9697 32.5177 17.0016 31.9445L17.3132 26.3344Z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M27.6501 20.9957C25.5695 21.5676 23.9603 23.0947 23.3388 25.1273L26.9166 24.263C27.2249 24.1651 27.541 24.0943 27.8608 24.051L27.6501 20.9957ZM27.4623 26.1887C27.8331 26.0637 28.225 25.9998 28.6199 25.9998H29.7321C29.877 25.9998 29.9915 25.8771 29.9816 25.7326L29.5321 19.2154C29.514 18.9532 29.2957 18.7483 29.0332 18.7616C24.7668 18.9779 21.3392 22.1481 21.0759 26.496L21.0409 27.0748C21.0205 27.4103 21.3306 27.6699 21.6574 27.591L27.4623 26.1887Z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M9.97943 7.4436C9.151 7.4436 8.47943 8.11518 8.47943 8.9436C8.47943 9.77203 9.151 10.4436 9.97943 10.4436C10.8079 10.4436 11.4794 9.77203 11.4794 8.9436C11.4794 8.11518 10.8079 7.4436 9.97943 7.4436ZM6.47943 8.9436C6.47943 7.01061 8.04643 5.4436 9.97943 5.4436C11.9124 5.4436 13.4794 7.01061 13.4794 8.9436C13.4794 10.8766 11.9124 12.4436 9.97943 12.4436C8.04643 12.4436 6.47943 10.8766 6.47943 8.9436Z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M12.2892 11.5724C13.89 12.0628 15.4984 12.5619 16.9652 13.2229C18.4666 13.8994 19.7498 14.7162 20.6751 15.794C21.078 16.2631 21.7727 16.3778 22.3078 16.0361C23.2259 15.45 24.2214 14.9766 25.2747 14.6343C26.0416 14.3851 26.4221 13.4395 25.9098 12.7222C22.8349 8.41712 17.5721 7.29333 12.9049 6.29673L12.7291 6.25919C12.4972 6.20965 12.2666 6.16037 12.0368 6.1109C12.7881 6.65766 13.3135 7.49612 13.4465 8.45985C17.5262 9.35293 21.2314 10.3649 23.6553 13.0977C23.0007 13.3635 22.369 13.6741 21.7639 14.0259C20.6369 12.8844 19.2384 12.0535 17.7869 11.3994C16.3539 10.7537 14.8161 10.2579 13.3706 9.81228C13.1936 10.5048 12.8099 11.1147 12.2892 11.5724Z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M6.73489 10.2576L3.66688 23.3278C3.662 23.3486 3.65791 23.3693 3.65458 23.3901L3.24193 25.6752C2.79136 28.1703 4.32855 30.5942 6.77759 31.2504L6.95328 31.2975C8.83697 31.8022 10.8402 31.1358 12.0461 29.6032L14.7636 26.1499C15.3754 25.3723 14.7578 24.2404 13.7728 24.3342L12.0501 24.4983L9.55234 23.9705L8.51501 23.6926L12.1328 11.7021C11.5641 12.1466 10.8543 12.419 10.0819 12.4412L6.65334 23.8044C6.46989 24.4124 6.82576 25.0517 7.43921 25.216L9.12205 25.667L9.14469 25.673L9.16762 25.6779L11.7818 26.2303C11.8932 26.2538 12.0076 26.2603 12.121 26.2495L12.4857 26.2148L10.6709 28.5211C9.89783 29.5035 8.6137 29.9307 7.40621 29.6071L7.23052 29.56C5.66063 29.1394 4.67525 27.5856 4.96407 25.9862L5.37643 23.7027L8.14177 11.922C7.5127 11.5331 7.01601 10.9506 6.73489 10.2576Z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M38.5 36H19.5C18.1193 36 17 37.1193 17 38.5C17 39.8807 18.1193 41 19.5 41H38.5C39.8807 41 41 39.8807 41 38.5C41 37.1193 39.8807 36 38.5 36ZM19.5 34C17.0147 34 15 36.0147 15 38.5C15 40.9853 17.0147 43 19.5 43H38.5C40.9853 43 43 40.9853 43 38.5C43 36.0147 40.9853 34 38.5 34H19.5Z" />
      <path fill="currentColor" d="M23 38.5C23 39.3284 22.3284 40 21.5 40C20.6716 40 20 39.3284 20 38.5C20 37.6716 20.6716 37 21.5 37C22.3284 37 23 37.6716 23 38.5Z" />
      <path fill="currentColor" d="M28 38.5C28 39.3284 27.3284 40 26.5 40C25.6716 40 25 39.3284 25 38.5C25 37.6716 25.6716 37 26.5 37C27.3284 37 28 37.6716 28 38.5Z" />
      <path fill="currentColor" d="M33 38.5C33 39.3284 32.3284 40 31.5 40C30.6716 40 30 39.3284 30 38.5C30 37.6716 30.6716 37 31.5 37C32.3284 37 33 37.6716 33 38.5Z" />
      <path fill="currentColor" d="M38 38.5C38 39.3284 37.3284 40 36.5 40C35.6716 40 35 39.3284 35 38.5C35 37.6716 35.6716 37 36.5 37C37.3284 37 38 37.6716 38 38.5Z" />
    </svg>
  );
}

/** Workers icon — user-supplied SVG (worker face in a hard hat), white filled paths. */
function WorkerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M17.3199 9.03191C16.0703 10.7525 15.7978 12.6711 16.1312 13.6886C16.3032 14.2134 16.0172 14.7783 15.4923 14.9503C14.9675 15.1223 14.4026 14.8362 14.2307 14.3114C13.6416 12.5136 14.1942 9.9322 15.7017 7.85662C17.2562 5.71624 19.8935 4 23.6364 4C27.4396 4 30.2748 5.56203 32.0123 7.63324C33.713 9.66056 34.4127 12.2597 33.7587 14.3046C33.5905 14.8307 33.0276 15.1207 32.5016 14.9525C31.9756 14.7842 31.6855 14.2214 31.8538 13.6954C32.2437 12.4761 31.8697 10.5752 30.48 8.91861C29.1272 7.30587 26.8555 6 23.6364 6C20.5742 6 18.5225 7.37611 17.3199 9.03191Z" />
      <path fill="currentColor" d="M19 6C19.5523 6 20 6.44772 20 7L20 11C20 11.5523 19.5523 12 19 12C18.4477 12 18 11.5523 18 11L18 7C18 6.44772 18.4477 6 19 6Z" />
      <path fill="currentColor" d="M24 4C24.5523 4 25 4.44772 25 5L25 9C25 9.55228 24.5523 10 24 10C23.4477 10 23 9.55228 23 9L23 5C23 4.4477 23.4477 4 24 4Z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M18.1254 29.6282C17.8971 29.1604 17.3814 28.9076 16.8786 29.0312C11.4745 30.3592 6 33.0671 6 37.1407V42V44H8H40H42V42V37.1407C42 33.0671 36.5255 30.3592 31.1214 29.0312C30.6186 28.9076 30.1029 29.1604 29.8746 29.6282L25.8105 29.6282C24.9218 29.6284 24.4693 29.6284 24.0248 29.6284C23.5637 29.6283 23.1112 29.6283 22.1893 29.6285L18.1254 29.6282ZM25.8109 31.6282C25.8107 31.6282 25.8106 31.6282 25.8105 31.6282C24.9162 31.6284 24.466 31.6284 24.024 31.6284C23.5658 31.6283 23.1162 31.6283 22.1898 31.6285L22.1892 31.6285L18.1252 31.6282L16.8758 31.6281L16.6456 31.1564C14.3233 31.7829 12.1328 32.655 10.5162 33.7244C8.69262 34.9307 8 36.0995 8 37.1407V42H40V37.1407C40 36.0995 39.3074 34.9307 37.4838 33.7244C35.8672 32.655 33.6767 31.7829 31.3544 31.1564L31.1242 31.6282L29.8746 31.6282L25.8109 31.6282Z" />
      <path fill="currentColor" d="M16 35C16 34.4477 16.4477 34 17 34C17.5523 34 18 34.4477 18 35V42C18 42.5523 17.5523 43 17 43C16.4477 43 16 42.5523 16 42V35Z" />
      <path fill="currentColor" d="M30 35C30 34.4477 30.4477 34 31 34C31.5523 34 32 34.4477 32 35V42C32 42.5523 31.5523 43 31 43C30.4477 43 30 42.5523 30 42V35Z" />
      <path fill="currentColor" d="M29 6C29.5523 6 30 6.44772 30 7L30 11C30 11.5523 29.5523 12 29 12C28.4477 12 28 11.5523 28 11L28 7C28 6.44772 28.4477 6 29 6Z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M12.5684 15.7642C12.3912 14.5044 13.1346 13.3201 14.3357 12.2526L15.6644 13.7474C14.6154 14.6798 14.5151 15.2456 14.5489 15.4857C14.5843 15.7374 14.8366 16.1525 15.7341 16.6084C17.4886 17.4996 20.6705 18 24 18C27.3295 18 30.5114 17.4996 32.2659 16.6084C33.1635 16.1525 33.4158 15.7374 33.4512 15.4857C33.4849 15.2456 33.3846 14.6798 32.3357 13.7474L33.6644 12.2526C34.8654 13.3201 35.6089 14.5044 35.4317 15.7642C35.2561 17.0126 34.2428 17.8475 33.1716 18.3916C30.9886 19.5004 27.4205 20 24 20C20.5795 20 17.0114 19.5004 14.8284 18.3916C13.7572 17.8475 12.7439 17.0126 12.5684 15.7642Z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M17 18C17 21.866 20.134 25 24 25C27.866 25 31 21.866 31 18H33C33 22.9706 28.9706 27 24 27C19.0294 27 15 22.9706 15 18H17Z" />
    </svg>
  );
}

import { toast } from "sonner";
import { FeedSkeleton } from "@/components/SkeletonFeed";
import { FeedVideo, isDirectVideoUrl } from "@/components/FeedVideo";
import { formatPrice } from "@/lib/price";
import storyCreateCover from "@/assets/categories/full-project.jpg";

type ViewerMedia = { type: "photo" | "video"; url: string };

/** Video tile in the mixed-media grid: preloads ahead, autoplays muted while visible. */
function AutoplayVideoTile({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const preloader = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          preloader.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    preloader.observe(el);
    const player = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void el.play().catch(() => undefined);
          else el.pause();
        }
      },
      { threshold: 0.5 },
    );
    player.observe(el);
    return () => {
      preloader.disconnect();
      player.disconnect();
    };
  }, []);

  return (
    <>
      <video
        ref={ref}
        src={url}
        muted
        loop
        playsInline
        preload={near ? "auto" : "metadata"}
        className="pointer-events-none h-full w-full object-cover brightness-90"
      />
      <span className="absolute right-2 top-2 rounded-full bg-black/60 p-2">
        <Play className="h-3 w-3 fill-white text-white" />
      </span>
    </>
  );
}


interface LikeInfo {
  count: number;
  mine: boolean;
  reaction?: ReactionId | null;
  top?: ReactionId[];
}

type TFn = (key: string) => string;

/** Shared empty defaults so cards without likes keep a stable prop identity. */
const EMPTY_LIKE: LikeInfo = { count: 0, mine: false, reaction: null, top: [] };
const EMPTY_RENTAL_LIKE = { count: 0, mine: false };

/* Memoized feed cards: liking/commenting one card no longer re-renders the whole feed. */

const RentalFeedCard = memo(function RentalFeedCard({
  r,
  like,
  commentCount,
  isOwner,
  t,
  onOpenComments,
  onToggleLike,
  onShare,
}: {
  r: RentalRow;
  like: { count: number; mine: boolean };
  commentCount: number;
  isOwner: boolean;
  t: TFn;
  onOpenComments: (id: string) => void;
  onToggleLike: (id: string) => void;
  onShare: (id: string) => void;
}) {
  return (
    <article className="block rounded-lg border border-border bg-surface px-3 py-3 shadow-card">
      <Link
        to="/rentals/$rentalId"
        params={{ rentalId: r.id }}
        className="block active:opacity-95"
      >
        <div className="flex items-center gap-3">
          <Avatar name={r.profiles?.full_name} url={r.profiles?.avatar_url} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{r.profiles?.full_name ?? "User"}</span>
              <span className="rounded-md bg-[#EEEDFE] px-1.5 py-0.5 text-[10px] font-bold text-[#26215C]">
                {t("for_rent_badge")}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {timeAgo(r.created_at, t)} · {r.location}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-foreground">{r.title}</h3>
            {r.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-base font-bold text-[#534AB7]">{formatPrice(r.price_per_day, r.currency)}</div>
            <div className="text-[10px] text-muted-foreground">{t("per_day")}</div>
          </div>
        </div>
        {r.rental_photos.length > 0 && (
          <div className={`mt-3 grid gap-2 ${r.rental_photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {r.rental_photos.slice(0, 2).map((p, i) => (
              <img key={i} src={p.photo_url} alt={`${r.title} — photo ${i + 1}`} loading="lazy" decoding="async" className="aspect-square w-full rounded-lg bg-muted object-cover" />
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {r.availability === "now" ? (
              <span className="rounded-pill bg-[#e8f8f0] px-2 py-0.5 text-[10px] font-semibold text-[#27ae60]">
                {t("available_now")}
              </span>
            ) : (
              <span className="rounded-pill bg-[#fff8e1] px-2 py-0.5 text-[10px] font-semibold text-[#b07d00]">
                {t("booked_until")} {r.available_from ?? ""}
              </span>
            )}
            <span className="rounded-pill bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-semibold text-[#26215C]">
              {r.category}
            </span>
          </div>
          {!isOwner && (
            <span className="rounded-lg bg-[#534AB7] px-3 py-1.5 text-xs font-semibold text-white">
              {t("contact")} →
            </span>
          )}
        </div>
      </Link>

      {(like.count > 0 || commentCount > 0) && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {like.count > 0 && (
              <>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#534AB7] text-white">
                  <ThumbsUp className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                {like.count}
              </>
            )}
          </span>
          {commentCount > 0 && (
            <button
              onClick={() => onOpenComments(r.id)}
              className="active:underline"
            >
              {commentCount} {t("comments").toLowerCase()}
            </button>
          )}
        </div>
      )}

      <footer className="mt-2 flex border-t border-border pt-1">
        <button
          onClick={() => onToggleLike(r.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium active:bg-muted ${
            like.mine ? "text-[#534AB7]" : "text-muted-foreground"
          }`}
        >
          <ThumbsUp className="h-4 w-4" fill={like.mine ? "currentColor" : "none"} />
          {t("like")}
        </button>
        <button
          onClick={() => onOpenComments(r.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground active:bg-muted"
        >
          <MessageSquare className="h-4 w-4" />
          {t("comment")}
        </button>
        <button
          onClick={() => onShare(r.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground active:bg-muted"
        >
          <Share2 className="h-4 w-4" />
          {t("share")}
        </button>
      </footer>
    </article>
  );
});

const PostFeedCard = memo(function PostFeedCard({
  p,
  like,
  commentCount,
  supplier,
  isAdmin,
  isOwner,
  highlighted,
  contacting,
  t,
  onEdit,
  onDelete,
  onOpenComments,
  onReact,
  onShare,
  onContact,
  onOpenViewer,
}: {
  p: PostRow;
  like: LikeInfo;
  commentCount: number;
  supplier: SupplierStoreInfo | undefined;
  isAdmin: boolean;
  isOwner: boolean;
  highlighted: boolean;
  contacting: boolean;
  t: TFn;
  onEdit: (p: PostRow) => void;
  onDelete: (id: string) => void;
  onOpenComments: (id: string) => void;
  onReact: (id: string, reaction: ReactionId | null) => void;
  onShare: (id: string) => void;
  onContact: (ownerId: string, storeId: string | undefined, postId: string) => void;
  onOpenViewer: (items: ViewerMedia[], index: number) => void;
}) {
  const isSupplierPost = !!supplier;
  const isSupplierLike = isSupplierPost || !!p.profiles?.is_supplier;
  return (
    <article
      id={`post-${p.id}`}
      className={`relative rounded-lg border border-border bg-surface px-3 py-3 shadow-card transition-shadow ${
        isSupplierLike ? "border-l-4 border-accent" : ""
      } ${highlighted ? "ring-2 ring-primary" : ""}`}
    >
      {isAdmin && !isOwner && (
        <button
          onClick={() => onDelete(p.id)}
          className="absolute -top-1 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white shadow active:scale-95"
          aria-label="Delete"
        >
          <X className="h-4 w-4" strokeWidth={3} />
        </button>
      )}
      <header className="flex items-center gap-3">
        {isSupplierPost ? (
          <Link
            to="/suppliers/$storeId"
            params={{ storeId: supplier.id }}
            className="active:opacity-60"
          >
            {supplier.logo_url ? (
               <img
                 src={supplier.logo_url}
                 alt={supplier.name}
                 loading="lazy"
                 decoding="async"
                 className="h-10 w-10 rounded-lg bg-muted object-cover"
               />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {supplier.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </Link>
        ) : (
          <Link to="/users/$userId" params={{ userId: p.user_id }} className="active:opacity-60">
            <Avatar name={p.profiles?.full_name} url={p.profiles?.avatar_url} size={40} />
          </Link>
        )}
        {isSupplierPost ? (
          <Link
            to="/suppliers/$storeId"
            params={{ storeId: supplier.id }}
            className="flex-1 active:opacity-60"
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{supplier.name}</span>
              <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {t("supplier_badge")}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {timeAgo(p.created_at, t)}
              {supplier.category && <> · {supplier.category}</>}
            </div>
          </Link>
        ) : (
          <Link to="/users/$userId" params={{ userId: p.user_id }} className="flex-1 active:opacity-60">
            <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
              <span className="truncate">{p.profiles?.full_name ?? "User"}</span>
              {p.profiles?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-400 text-white" />}
              {p.profiles?.is_recruiter && <Briefcase className="h-4 w-4 shrink-0 text-amber-500" />}
              {p.profiles?.is_featured && <Sparkles className="h-4 w-4 shrink-0 text-pink-500" />}
              {p.profiles?.is_supplier && (
                <span className="shrink-0 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {t("supplier_badge")}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{timeAgo(p.created_at, t)}</div>
          </Link>
        )}
        {isOwner ? (
          <OwnerMenu
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
          />
        ) : (
          <ReportMenu targetKind="post" targetId={p.id} />
        )}
      </header>
      {p.content && <p className="mt-2 text-sm leading-relaxed text-foreground">{p.content}</p>}
      {(() => {
        const directVideo =
          p.video_url && isDirectVideoUrl(p.video_url) ? p.video_url : null;
        const media: ViewerMedia[] = [
          ...(directVideo ? [{ type: "video" as const, url: directVideo }] : []),
          ...p.post_photos.map((ph) => ({ type: "photo" as const, url: ph.photo_url })),
        ];
        if (media.length === 0) return null;
        const total = media.length;
        return (
          <div className={`mt-3 grid gap-2 ${total === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {media.slice(0, 4).map((m, i) => {
              const extra = i === 3 && total > 4 ? total - 4 : 0;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onOpenViewer(media, i)}
                  className={`relative block w-full overflow-hidden rounded-lg bg-black ${total === 1 ? "" : "aspect-square"}`}
                >
                  {m.type === "photo" ? (
                    <img
                      src={m.url}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover brightness-90"
                      alt={p.content ? `${p.content.slice(0, 80)} — ${i + 1}` : `Post photo ${i + 1}`}
                    />
                  ) : (
                    <AutoplayVideoTile url={m.url} />
                  )}
                  {extra > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-bold text-white">
                      +{extra}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {p.video_url && !isDirectVideoUrl(p.video_url) && <VideoEmbed url={p.video_url} />}

      {isSupplierLike && !isOwner && (
        <button
          onClick={() => onContact(p.user_id, supplier?.id, p.id)}
          disabled={contacting}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-sm font-bold text-white shadow active:scale-[0.98] disabled:opacity-50"
        >
          {t("contact_supplier")} <ArrowRight className="h-4 w-4" />
        </button>
      )}


      {(like.count > 0 || commentCount > 0) && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {like.count > 0 && (
              <>
                <span className="flex items-center -space-x-0.5">
                  {((like.top && like.top.length > 0) ? like.top : (["like"] as ReactionId[])).map((rid) => (
                    <span
                      key={rid}
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-card text-[10px] leading-none ring-1 ring-border"
                    >
                      {reactionMeta(rid)?.emoji ?? "👍"}
                    </span>
                  ))}
                </span>
                {like.count}
              </>
            )}
          </span>
          {commentCount > 0 && (
            <button
              onClick={() => onOpenComments(p.id)}
              className="active:underline"
            >
              {commentCount} {t("comments").toLowerCase()}
            </button>
          )}
        </div>
      )}

      <footer className="mt-2 flex border-t border-border pt-1">
        <ReactionButton
          mine={like.reaction ?? null}
          onReact={(r) => onReact(p.id, r)}
          label={t("like")}
        />
        <button
          onClick={() => onOpenComments(p.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground active:bg-muted"
        >
          <MessageSquare className="h-4 w-4" />
          {t("comment")}
        </button>
        <button
          onClick={() => onShare(p.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-muted-foreground active:bg-muted"
        >
          <Share2 className="h-4 w-4" />
          {t("share")}
        </button>
      </footer>
    </article>
  );
});

interface SupplierStoreInfo {
  id: string;
  name: string;
  logo_url: string | null;
  category: string | null;
  photos: string[];
}

export const Route = createFileRoute("/home")({
  validateSearch: (s: Record<string, unknown>): { post?: string } => ({
    post: typeof s.post === "string" ? s.post : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Home feed — BuildHub" },
      { name: "description", content: "Your BuildHub feed: latest jobs, stories, and updates from Cambodia's construction community." },
      { property: "og:title", content: "Home feed — BuildHub" },
      { property: "og:description", content: "Your BuildHub feed: latest jobs, stories, and updates from Cambodia's construction community." },
      { property: "og:url", content: "https://buildhubkh.com/home" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/home" }],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <HomePage />
      </AppShell>
    </RequireAuth>
  ),
});

interface PostRow {
  id: string;
  user_id: string;
  content: string | null;
  video_url: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null; is_verified: boolean | null; is_recruiter: boolean | null; is_featured: boolean | null; is_supplier?: boolean | null } | null;
  post_photos: { photo_url: string }[];
}

interface RentalRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  price_per_day: number;
  currency: string;
  location: string;
  availability: string;
  available_from: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  rental_photos: { photo_url: string }[];
}

interface StoryRow {
  id: string;
  user_id: string;
  media_url: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface StoryGroup {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  cover: string;
}

function HomePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { post: focusPostId } = Route.useSearch();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean; reaction: ReactionId | null; top: ReactionId[] }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [supplierByUser, setSupplierByUser] = useState<Record<string, SupplierStoreInfo>>({});
  const [contactingUser, setContactingUser] = useState<string | null>(null);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [rentalLikes, setRentalLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [rentalCommentCounts, setRentalCommentCounts] = useState<Record<string, number>>({});
  const [openRentalComments, setOpenRentalComments] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<PostRow | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  // Viewer state: photos array is stable; current index lives in a ref so scroll
  // never triggers React re-renders (which cause jank). Display index is updated
  // only after scroll ends or when arrows are clicked.
  const [viewer, setViewer] = useState<{ items: ViewerMedia[]; index: number } | null>(null);
  const viewerScrollRef = useRef<HTMLDivElement | null>(null);
  const viewerIndexRef = useRef(0);
  const [viewerDisplayIndex, setViewerDisplayIndex] = useState(0);

  const [storiesLoading, setStoriesLoading] = useState(false);

  // Sync display index when viewer opens or arrow buttons are used
  useEffect(() => {
    if (viewer) {
      viewerIndexRef.current = viewer.index;
      setViewerDisplayIndex(viewer.index);
    }
  }, [viewer?.items, viewer?.index]);

  // Scroll to the correct slide when viewer opens (no smooth here – instant)
  useEffect(() => {
    if (!viewer) return;
    const el = viewerScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: viewer.index * el.clientWidth });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer?.items]);

  // Update display index on scroll end (native event, no re-renders during swipe)
  useEffect(() => {
    const el = viewerScrollRef.current;
    if (!el || !viewer) return;
    const onEnd = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx !== viewerIndexRef.current) {
        viewerIndexRef.current = idx;
        setViewerDisplayIndex(idx);
      }
    };
    el.addEventListener("scrollend", onEnd);
    return () => el.removeEventListener("scrollend", onEnd);
  }, [viewer]);

  // Profile + stories load once per user (cheap, separate from paginated feed)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setProfile(data);
        const { data: flags } = await supabase.rpc("get_my_profile_flags");
        if (cancelled) return;
        setIsAdmin(!!flags?.[0]?.is_admin);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setStoriesLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("stories")
          .select("id, user_id, media_url, created_at, profiles(full_name, avatar_url)")
          .eq("status", "approved")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(50);
        if (cancelled) return;
        const rows = (data as StoryRow[] | null) ?? [];
        const map = new Map<string, StoryGroup>();
        for (const r of rows) {
          if (!map.has(r.user_id)) {
            map.set(r.user_id, {
              id: r.id,
              user_id: r.user_id,
              full_name: r.profiles?.full_name ?? null,
              avatar_url: r.profiles?.avatar_url ?? null,
              cover: r.media_url,
            });
          }
        }
        setStories(Array.from(map.values()));
      } catch {
        // ignore
      } finally {
        if (!cancelled) setStoriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Feed variety: a seed that changes on every pull-to-refresh so the order
  // feels fresh without losing recency (items are shuffled within small blocks).
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.floor(Math.random() * 1_000_000));

  // Paginated feed: 20 posts + 20 rentals per page, merged client-side
  const PAGE_SIZE = 20;

  const feedQuery = useInfiniteQuery({
    queryKey: ["home:feed", user?.id ?? null],
    enabled: !!user,
    staleTime: 30_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const [{ data: postsData }, { data: rentalsData }] = await Promise.all([
        supabase
          .from("posts")
          .select("id, user_id, content, video_url, created_at, profiles(full_name, avatar_url, is_verified, is_recruiter, is_featured, is_supplier), post_photos(photo_url)")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .range(from, to),
        supabase
          .from("rental_listings")
          .select("id, user_id, title, description, category, price_per_day, currency, location, availability, available_from, created_at, profiles(full_name, avatar_url), rental_photos(photo_url)")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .range(from, to),
      ]);
      const postRows = (postsData as PostRow[] | null) ?? [];
      const rentalRows = (rentalsData as RentalRow[] | null) ?? [];

      // Build auxiliary maps scoped to this page's IDs
      const likeMap: Record<string, { count: number; mine: boolean; reaction: ReactionId | null; top: ReactionId[] }> = {};
      const likeCounts: Record<string, Record<string, number>> = {};
      const cMap: Record<string, number> = {};
      const rLikeMap: Record<string, { count: number; mine: boolean }> = {};
      const rcMap: Record<string, number> = {};
      const supplierMap: Record<string, SupplierStoreInfo> = {};

      const auxTasks: Array<Promise<unknown>> = [];

      if (postRows.length > 0) {
        const ids = postRows.map((p) => p.id);
        for (const id of ids) {
          likeMap[id] = { count: 0, mine: false, reaction: null, top: [] };
          likeCounts[id] = {};
          cMap[id] = 0;
        }
        auxTasks.push(
          (async () => {
            const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
              supabase.from("post_likes").select("post_id, user_id, reaction").in("post_id", ids),
              supabase.from("post_comments").select("post_id").in("post_id", ids),
            ]);
            for (const r of likeRows ?? []) {
              const e = likeMap[r.post_id];
              if (!e) continue;
              e.count += 1;
              const rid = (r.reaction as ReactionId) ?? "like";
              likeCounts[r.post_id][rid] = (likeCounts[r.post_id][rid] ?? 0) + 1;
              if (r.user_id === user!.id) {
                e.mine = true;
                e.reaction = rid;
              }
            }
            for (const id of ids) {
              likeMap[id].top = topReactions(likeCounts[id]);
            }
            for (const r of commentRows ?? []) cMap[r.post_id] = (cMap[r.post_id] ?? 0) + 1;
          })(),
        );

        const userIds = Array.from(new Set(postRows.map((p) => p.user_id)));
        auxTasks.push(
          (async () => {
            const { data: stores } = await supabase
              .from("supplier_stores")
              .select("id, user_id, name, logo_url, supplier_store_categories(supplier_categories(name_en, name_km)), supplier_store_photos(photo_url, sort_order)")
              .in("user_id", userIds);
            for (const s of (stores ?? []) as Array<{
              id: string;
              user_id: string;
              name: string;
              logo_url: string | null;
              supplier_store_categories: Array<{ supplier_categories: { name_en: string; name_km: string } | null }>;
              supplier_store_photos: Array<{ photo_url: string; sort_order: number | null }>;
            }>) {
              const catObj = s.supplier_store_categories?.[0]?.supplier_categories ?? null;
              const photos = (s.supplier_store_photos ?? [])
                .slice()
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((p) => p.photo_url);
              supplierMap[s.user_id] = {
                id: s.id,
                name: s.name,
                logo_url: s.logo_url,
                category: catObj ? (lang === "km" ? catObj.name_km : catObj.name_en) : null,
                photos,
              };
            }
          })(),
        );
      }

      if (rentalRows.length > 0) {
        const rIds = rentalRows.map((r) => r.id);
        for (const id of rIds) {
          rLikeMap[id] = { count: 0, mine: false };
          rcMap[id] = 0;
        }
        auxTasks.push(
          (async () => {
            const [{ data: rLikeRows }, { data: rCommentRows }] = await Promise.all([
              supabase.from("rental_likes").select("rental_id, user_id").in("rental_id", rIds),
              supabase.from("rental_comments").select("rental_id").in("rental_id", rIds),
            ]);
            for (const r of rLikeRows ?? []) {
              const e = rLikeMap[r.rental_id];
              if (!e) continue;
              e.count += 1;
              if (r.user_id === user!.id) e.mine = true;
            }
            for (const r of rCommentRows ?? []) rcMap[r.rental_id] = (rcMap[r.rental_id] ?? 0) + 1;
          })(),
        );
      }

      await Promise.all(auxTasks);

      return {
        posts: postRows,
        rentals: rentalRows,
        likes: likeMap,
        commentCounts: cMap,
        rentalLikes: rLikeMap,
        rentalCommentCounts: rcMap,
        supplierByUser: supplierMap,
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      // If either bucket returned a full page, assume more items exist
      if (lastPage.posts.length === PAGE_SIZE || lastPage.rentals.length === PAGE_SIZE) {
        return allPages.length;
      }
      return undefined;
    },
  });

  const loading = feedQuery.isLoading;

  // New seed whenever the feed is refreshed (pull-to-refresh / invalidate),
  // but not when loading additional pages while scrolling.
  const wasRefetching = useRef(false);
  useEffect(() => {
    const refetching = feedQuery.isRefetching && !feedQuery.isFetchingNextPage;
    if (refetching && !wasRefetching.current) {
      setShuffleSeed(Math.floor(Math.random() * 1_000_000));
    }
    wasRefetching.current = refetching;
  }, [feedQuery.isRefetching, feedQuery.isFetchingNextPage]);


  // Sync paginated query data into existing component state (preserves
  // optimistic-update logic for likes/comment counts).
  useEffect(() => {
    if (!feedQuery.data) return;
    const pages = feedQuery.data.pages;
    setPosts(pages.flatMap((p) => p.posts));
    setRentals(pages.flatMap((p) => p.rentals));
    setLikes(Object.assign({}, ...pages.map((p) => p.likes)));
    setCommentCounts(Object.assign({}, ...pages.map((p) => p.commentCounts)));
    setRentalLikes(Object.assign({}, ...pages.map((p) => p.rentalLikes)));
    setRentalCommentCounts(Object.assign({}, ...pages.map((p) => p.rentalCommentCounts)));
    setSupplierByUser(Object.assign({}, ...pages.map((p) => p.supplierByUser)));
  }, [feedQuery.data]);

  // IntersectionObserver sentinel: fetch next page when bottom comes into view
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
          void feedQuery.fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feedQuery.hasNextPage, feedQuery.isFetchingNextPage, feedQuery]);

  // Realtime: invalidate paginated feed when relevant tables change.
  // Runs for guests too. Invalidating refetches and the persister rewrites the
  // offline snapshot automatically, so we never wipe the whole cache here.
  useEffect(() => {
    const uid = user?.id ?? null;
    const inv = () => {
      void qc.invalidateQueries({ queryKey: ["home:feed", uid] });
    };
    const invStories = () => {
      void qc.invalidateQueries({ queryKey: ["home:feed", uid] });
      // Re-fetch stories directly since we no longer cache them via useQuery
      if (!user) return;
      let cancelled = false;
      setStoriesLoading(true);
      (async () => {
        try {
          const { data } = await supabase
            .from("stories")
            .select("id, user_id, media_url, created_at, profiles(full_name, avatar_url)")
            .eq("status", "approved")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(50);
          if (cancelled) return;
          const rows = (data as StoryRow[] | null) ?? [];
          const map = new Map<string, StoryGroup>();
          for (const r of rows) {
            if (!map.has(r.user_id)) {
              map.set(r.user_id, {
                id: r.id,
                user_id: r.user_id,
                full_name: r.profiles?.full_name ?? null,
                avatar_url: r.profiles?.avatar_url ?? null,
                cover: r.media_url,
              });
            }
          }
          setStories(Array.from(map.values()));
        } catch {
          // ignore
        } finally {
          if (!cancelled) setStoriesLoading(false);
        }
      })();
    };
    const ch = supabase
      .channel(`home-feed:${uid ?? "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_listings" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_likes" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_comments" }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, invStories)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);


  // Ensure the focused post is in the feed (fetch + prepend if missing),
  // then scroll it into view and briefly highlight it.
  useEffect(() => {
    if (!focusPostId || loading) return;
    let cancelled = false;
    const inFeed = posts.some((p) => p.id === focusPostId);

    async function ensureAndScroll() {
      if (!inFeed) {
        const { data: pData } = await supabase
          .from("posts")
          .select("id, user_id, content, video_url, created_at, profiles(full_name, avatar_url, is_verified, is_recruiter, is_featured, is_supplier), post_photos(photo_url)")
          .eq("id", focusPostId!)
          .maybeSingle();
        if (cancelled || !pData) return;
        const row = pData as unknown as PostRow;
        setPosts((cur) => (cur.some((p) => p.id === row.id) ? cur : [row, ...cur]));
        // Hydrate like / comment counts for this single post
        const [{ data: likeRows }, { data: cmtRows }] = await Promise.all([
          supabase.from("post_likes").select("user_id, reaction").eq("post_id", focusPostId!),
          supabase.from("post_comments").select("id").eq("post_id", focusPostId!),
        ]);
        if (cancelled) return;
        const myRow = user ? likeRows?.find((r) => r.user_id === user.id) : null;
        const counts: Record<string, number> = {};
        for (const r of likeRows ?? []) {
          const rid = (r.reaction as ReactionId) ?? "like";
          counts[rid] = (counts[rid] ?? 0) + 1;
        }
        setLikes((m) => ({
          ...m,
          [focusPostId!]: {
            count: likeRows?.length ?? 0,
            mine: !!myRow,
            reaction: (myRow?.reaction as ReactionId) ?? null,
            top: topReactions(counts),
          },
        }));
        setCommentCounts((m) => ({ ...m, [focusPostId!]: cmtRows?.length ?? 0 }));
      }

      // Retry across frames — newly prepended posts (and their images) may
      // still be laying out, so the element height shifts after first paint.
      let tries = 0;
      const tick = () => {
        if (cancelled) return;
        const el = document.getElementById(`post-${focusPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightId(focusPostId!);
          setTimeout(() => setHighlightId(null), 2200);
          return;
        }
        if (tries++ < 20) setTimeout(tick, 100);
      };
      requestAnimationFrame(tick);

    }

    void ensureAndScroll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPostId, loading]);

  async function deletePost(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error(t("delete_failed"));
      return;
    }
    setPosts((p) => p.filter((x) => x.id !== id));
    setDeletingPostId(null);
    toast.success(t("deleted"));
  }

  async function saveEditPost(values: Record<string, string>) {
    if (!editingPost) return;
    const content = (values.content ?? "").trim();
    const { error } = await supabase.from("posts").update({ content }).eq("id", editingPost.id);
    if (error) {
      toast.error(t("error_generic"));
      return;
    }
    setPosts((p) => p.map((x) => (x.id === editingPost.id ? { ...x, content } : x)));
    setEditingPost(null);
  }

  // Ref mirrors let the callbacks below stay stable (useCallback) so memoized
  // feed cards don't re-render when an unrelated post's like state changes.
  const likesRef = useRef(likes);
  likesRef.current = likes;
  const rentalLikesRef = useRef(rentalLikes);
  rentalLikesRef.current = rentalLikes;

  const reactToPost = useCallback(async (postId: string, reaction: ReactionId | null) => {
    if (!user) return;
    const cur0 = likesRef.current[postId] ?? { count: 0, mine: false, reaction: null, top: [] };
    const cur = { ...cur0, top: cur0.top ?? [] };
    // optimistic
    setLikes((m) => ({
      ...m,
      [postId]: reaction
        ? {
            count: cur.count + (cur.mine ? 0 : 1),
            mine: true,
            reaction,
            top: cur.mine
              ? cur.top.map((t) => (t === cur.reaction ? reaction : t))
              : Array.from(new Set([reaction, ...cur.top])).slice(0, 3),
          }
        : {
            count: cur.count - 1,
            mine: false,
            reaction: null,
            top: cur.top.filter((t) => t !== cur.reaction),
          },
    }));
    let error;
    if (!reaction) {
      ({ error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id));
    } else if (cur.mine) {
      ({ error } = await supabase
        .from("post_likes")
        .update({ reaction })
        .eq("post_id", postId)
        .eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id, reaction }));
    }
    if (error) setLikes((m) => ({ ...m, [postId]: cur }));
  }, [user]);

  const contactSupplier = useCallback(async (ownerId: string, storeId: string | undefined, postId?: string) => {
    if (!user || user.id === ownerId) return;
    setContactingUser(ownerId);
    try {
      const [a, b] = [user.id, ownerId].sort();
      const { data: existing } = await supabase
        .from("message_threads")
        .select("id")
        .eq("participant_a", a)
        .eq("participant_b", b)
        .maybeSingle();
      let threadId = existing?.id;
      if (!threadId) {
        const { data: created, error } = await supabase
          .from("message_threads")
          .insert({ participant_a: a, participant_b: b })
          .select("id")
          .single();
        if (error) throw error;
        threadId = created.id;
      }
      if (storeId) void supabase.rpc("increment_supplier_contact", { _store_id: storeId });
      nav({ to: "/messages/$threadId", params: { threadId }, search: postId ? { pin: `post:${postId}` } : {} });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setContactingUser(null);
    }
  }, [user, nav]);

  const sharePost = useCallback(async (postId: string) => {
    const url = `${window.location.origin}/home?post=${postId}`;
    const shareData = { title: t("app_name"), url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share_link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  }, [t]);

  const toggleRentalLike = useCallback(async (rentalId: string) => {
    if (!user) return;
    const cur = rentalLikesRef.current[rentalId] ?? { count: 0, mine: false };
    setRentalLikes((m) => ({
      ...m,
      [rentalId]: { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine },
    }));
    if (cur.mine) {
      const { error } = await supabase
        .from("rental_likes")
        .delete()
        .eq("rental_id", rentalId)
        .eq("user_id", user.id);
      if (error) setRentalLikes((m) => ({ ...m, [rentalId]: cur }));
    } else {
      const { error } = await supabase
        .from("rental_likes")
        .insert({ rental_id: rentalId, user_id: user.id });
      if (error) setRentalLikes((m) => ({ ...m, [rentalId]: cur }));
    }
  }, [user]);

  const shareRental = useCallback(async (rentalId: string) => {
    const url = `${window.location.origin}/rentals/${rentalId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("app_name"), url });
        return;
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share_link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  }, [t]);

  // Stable callbacks passed to the memoized feed cards.
  const openCommentsCb = useCallback((id: string) => setOpenComments(id), []);
  const openRentalCommentsCb = useCallback((id: string) => setOpenRentalComments(id), []);
  const editPostCb = useCallback((p: PostRow) => setEditingPost(p), []);
  const deletePostCb = useCallback((id: string) => setDeletingPostId(id), []);
  const openViewerCb = useCallback((items: ViewerMedia[], index: number) => setViewer({ items, index }), []);
  const reactCb = useCallback((id: string, r: ReactionId | null) => void reactToPost(id, r), [reactToPost]);
  const sharePostCb = useCallback((id: string) => void sharePost(id), [sharePost]);
  const shareRentalCb = useCallback((id: string) => void shareRental(id), [shareRental]);
  const toggleRentalLikeCb = useCallback((id: string) => void toggleRentalLike(id), [toggleRentalLike]);
  const contactCb = useCallback(
    (ownerId: string, storeId: string | undefined, postId: string) => void contactSupplier(ownerId, storeId, postId),
    [contactSupplier],
  );

  async function recordStoryOpen(storyId: string, ownerId: string) {
    if (!user || ownerId === user.id) return;
    const { error } = await supabase
      .from("story_views")
      .insert({ story_id: storyId, viewer_id: user.id });
    if (error && error.code !== "23505") console.error("story_view insert failed", error);
  }

  const focused = !!focusPostId;

  // Merge + block-shuffle only when the data or seed changes — not on every
  // like/comment state update.
  const feedItems = useMemo(() => {
    type FeedItem =
      | { kind: "post"; created_at: string; data: PostRow }
      | { kind: "rental"; created_at: string; data: RentalRow };
    const visiblePosts = focused ? posts.filter((p) => p.id === focusPostId) : posts;
    const visibleRentals = focused ? [] : rentals;
    const items: FeedItem[] = [
      ...visiblePosts.map((p) => ({ kind: "post" as const, created_at: p.created_at, data: p })),
      ...visibleRentals.map((r) => ({ kind: "rental" as const, created_at: r.created_at, data: r })),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    // Shuffle within blocks of 4 so recent content stays near the top
    // but the exact order varies on each refresh.
    if (!focused) {
      const rand = (n: number) => {
        const x = Math.sin(shuffleSeed * 9301 + n * 49297) * 233280;
        return x - Math.floor(x);
      };
      const BLOCK = 4;
      for (let start = 0; start < items.length; start += BLOCK) {
        const block = items.slice(start, start + BLOCK);
        block
          .map((it, i) => ({ it, k: rand(start + i) }))
          .sort((a, b) => a.k - b.k)
          .forEach(({ it }, i) => {
            items[start + i] = it;
          });
      }
    }
    return items;
  }, [posts, rentals, focused, focusPostId, shuffleSeed]);

  return (
    <div>
      <h1 className="sr-only">BuildHub Community Feed</h1>
      
      
      {focused && (
        <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2 shadow-card">
          <button
            onClick={() => nav({ to: "/home", search: {} })}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground active:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">{t("post") ?? "Post"}</span>
        </div>
      )}
      {!focused && (<>
      {/* Search and create */}
      <div className="flex items-center gap-2 bg-surface px-3 py-3">
        <Link to="/profile" className="shrink-0 active:opacity-60" aria-label="My profile">
          <Avatar name={profile?.full_name} url={profile?.avatar_url} size={36} />
        </Link>
        <Link
          to="/search"
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm text-muted-foreground shadow-sm active:bg-muted"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">{lang === "km" ? "តើអ្នកត្រូវការអ្វីថ្ងៃនេះ?" : "What do you need today?"}</span>
        </Link>
        <Link to="/announce" className="tap rounded-md p-2 text-primary active:bg-primary/10" aria-label={t("nav_announce")}>
          <SquarePen className="h-6 w-6" />
        </Link>
      </div>

      {/* Five primary shortcuts */}
      <div className="grid grid-cols-5 gap-x-1 border-y border-border bg-surface px-3 py-2.5">
        {[
          { to: "/listings" as const, label: lang === "km" ? "រកការងារ" : "Find work", icon: BriefcaseBusiness, tone: "bg-shortcut-blue text-primary-foreground" },
          { to: "/find-worker" as const, label: lang === "km" ? "អ្នកជំនាញ" : "Workers", icon: WorkerIcon, tone: "bg-shortcut-green text-primary-foreground" },
          { to: "/suppliers" as const, label: lang === "km" ? "សម្ភារៈ" : "Materials", icon: MaterialsIcon, tone: "bg-shortcut-orange text-primary-foreground", search: { mode: "shops" as const } },
          { to: "/market" as const, label: lang === "km" ? "ម៉ាស៊ីន និងឧបករណ៍" : "Machinery & Tools", icon: MachineryIcon, tone: "bg-shortcut-slate text-primary-foreground", search: { mode: "rent" as const } },
          { to: "/rewards" as const, label: lang === "km" ? "រង្វាន់" : "Reward", icon: Gift, tone: "bg-shortcut-gold text-primary-foreground" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={`${item.to}-${item.label}`} to={item.to} search={item.search} className="tap flex min-w-0 flex-col items-center gap-1 text-center">
              <span className={`grid h-12 w-[50px] place-items-center rounded-lg ${item.tone} shadow-sm`}>
                <Icon className="h-6 w-6" strokeWidth={2.2} />
              </span>
              <span className="line-clamp-2 text-[10px] font-semibold leading-3.5 text-foreground">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Stories row */}
      <h2 className="sr-only">Stories</h2>
      <div className="no-scrollbar flex gap-2 overflow-x-auto bg-surface px-3 py-3">
        <Link
          to="/story/new"
          className="tap relative h-36 w-[92px] shrink-0 overflow-hidden rounded-lg bg-muted"
        >
          <img src={profile?.avatar_url || storyCreateCover} alt="" className="absolute inset-0 h-full w-full object-cover brightness-[0.72]" />
          <span className="absolute inset-x-0 bottom-0 h-16 bg-story-fade" />
          <span className="absolute bottom-9 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border-2 border-primary-foreground bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" strokeWidth={3} />
          </span>
          <span className="absolute inset-x-1 bottom-2 text-center text-[10px] font-bold leading-3 text-primary-foreground">{t("create_story")}</span>
        </Link>
        {storiesLoading && stories.length === 0 &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={`sk-${i}`} className="h-36 w-[92px] shrink-0 animate-pulse rounded-lg bg-muted">
            </div>
          ))}
        {stories.map((s) => (
          <Link
            key={s.user_id}
            to="/story/view"
            search={{ user: s.user_id }}
            onClick={() => void recordStoryOpen(s.id, s.user_id)}
            className="tap relative h-36 w-[92px] shrink-0 overflow-hidden rounded-lg bg-muted"
          >
            <img src={s.cover} alt={`Story from ${s.full_name ?? "user"}`} className="absolute inset-0 h-full w-full object-cover brightness-[0.72]" />
            <span className="absolute inset-x-0 bottom-0 h-16 bg-story-fade" />
            <span className="absolute left-2 top-2 rounded-full border-2 border-accent bg-surface p-0.5">
              <Avatar name={s.full_name} url={s.avatar_url} size={26} />
            </span>
            <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-[10px] font-bold leading-3 text-primary-foreground">
              {s.full_name ?? "User"}
            </span>
          </Link>
        ))}
      </div>
      </>)}

      {/* Feed */}
      <h2 className="sr-only">Community Feed</h2>
      <div className="space-y-3 bg-background px-2 py-3">
        {loading && <FeedSkeleton count={3} />}
        {!loading && !focused && posts.length === 0 && (
          <div className="bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("no_posts")}
            <div className="mt-3">
              <Link to="/listings" className="text-sm font-semibold text-primary">
                {t("nav_listings")} →
              </Link>
            </div>
          </div>
        )}
        {!loading && focused && !posts.some((p) => p.id === focusPostId) && (
          <div className="bg-surface p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("loading")}
          </div>
        )}
        {feedItems.map((item) =>
          item.kind === "rental" ? (
            <RentalFeedCard
              key={`r-${item.data.id}`}
              r={item.data}
              like={rentalLikes[item.data.id] ?? EMPTY_RENTAL_LIKE}
              commentCount={rentalCommentCounts[item.data.id] ?? 0}
              isOwner={user?.id === item.data.user_id}
              t={t}
              onOpenComments={openRentalCommentsCb}
              onToggleLike={toggleRentalLikeCb}
              onShare={shareRentalCb}
            />
          ) : (
            <PostFeedCard
              key={item.data.id}
              p={item.data}
              like={likes[item.data.id] ?? EMPTY_LIKE}
              commentCount={commentCounts[item.data.id] ?? 0}
              supplier={supplierByUser[item.data.user_id]}
              isAdmin={isAdmin}
              isOwner={user?.id === item.data.user_id}
              highlighted={highlightId === item.data.id}
              contacting={contactingUser === item.data.user_id}
              t={t}
              onEdit={editPostCb}
              onDelete={deletePostCb}
              onOpenComments={openCommentsCb}
              onReact={reactCb}
              onShare={sharePostCb}
              onContact={contactCb}
              onOpenViewer={openViewerCb}
            />
          ),
        )}

        {/* Infinite-scroll sentinel: triggers fetchNextPage when in view */}
        {!focused && feedQuery.hasNextPage && (
          <div ref={sentinelRef} className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            {feedQuery.isFetchingNextPage ? t("loading") : ""}
          </div>
        )}
      </div>

      {openComments && (
        <CommentsSheet
          postId={openComments}
          onClose={() => setOpenComments(null)}
          onCountChange={(n) => setCommentCounts((m) => ({ ...m, [openComments]: n }))}
        />
      )}

      {openRentalComments && (
        <RentalCommentsSheet
          rentalId={openRentalComments}
          onClose={() => setOpenRentalComments(null)}
          onCountChange={(n) => setRentalCommentCounts((m) => ({ ...m, [openRentalComments]: n }))}
        />
      )}

      <EditTextDialog
        open={!!editingPost}
        title={t("edit")}
        fields={
          editingPost
            ? [
                {
                  key: "content",
                  label: t("description"),
                  initial: editingPost.content ?? "",
                  type: "textarea",
                  required: true,
                },
              ]
            : []
        }
        onCancel={() => setEditingPost(null)}
        onSave={saveEditPost}
      />

      <ConfirmDialog
        open={!!deletingPostId}
        title={t("delete")}
        description={t("delete_confirm_desc")}
        destructive
        onConfirm={() => {
          if (deletingPostId) void deletePost(deletingPostId);
        }}
        onCancel={() => setDeletingPostId(null)}
      />

      {viewer &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex flex-col bg-black"
            onClick={(e) => {
              if (e.currentTarget === e.target) setViewer(null);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex h-14 shrink-0 items-center justify-between px-4 text-white">
              <span className="text-sm font-semibold tabular-nums">
                {viewerDisplayIndex + 1} / {viewer.items.length}
              </span>
              <button
                onClick={() => setViewer(null)}
                aria-label="Close"
                className="rounded-full p-2 active:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image strip: horizontal swipe, one image per viewport */}
            <div
              ref={viewerScrollRef}
              className="no-scrollbar relative flex h-full min-h-0 w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
            >
              {viewer.items.map((m, i) => (
                <div
                  key={i}
                  className="flex h-full w-full shrink-0 snap-center items-center justify-center"
                  onClick={(e) => {
                    if (e.currentTarget === e.target) setViewer(null);
                  }}
                >
                  {m.type === "photo" ? (
                    <img
                      src={m.url}
                      alt={`Photo ${i + 1}`}
                      draggable={false}
                      className="max-h-full max-w-full select-none object-contain"
                    />
                  ) : (
                    <video
                      src={m.url}
                      controls
                      autoPlay={i === viewer.index}
                      playsInline
                      className="max-h-full max-w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Desktop arrows */}
            <div className="pointer-events-none absolute inset-y-14 left-0 right-0 flex items-center justify-between px-2">
              {viewerDisplayIndex > 0 && (
                <button
                  onClick={() => {
                    const el = viewerScrollRef.current;
                    if (!el) return;
                    const idx = Math.max(0, viewerDisplayIndex - 1);
                    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
                    viewerIndexRef.current = idx;
                    setViewerDisplayIndex(idx);
                  }}
                  className="pointer-events-auto rounded-full bg-black/40 p-2 text-white backdrop-blur-sm active:bg-black/60"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              {viewerDisplayIndex < viewer.items.length - 1 && (
                <button
                  onClick={() => {
                    const el = viewerScrollRef.current;
                    if (!el) return;
                    const idx = Math.min(viewer.items.length - 1, viewerDisplayIndex + 1);
                    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
                    viewerIndexRef.current = idx;
                    setViewerDisplayIndex(idx);
                  }}
                  className="pointer-events-auto ml-auto rounded-full bg-black/40 p-2 text-white backdrop-blur-sm active:bg-black/60"
                  aria-label="Next"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Swipe hint */}
            <div className="pointer-events-none flex h-10 shrink-0 items-center justify-center text-xs text-white/60">
              {viewerDisplayIndex < viewer.items.length - 1 ? "Swipe for next" : ""}
            </div>
          </div>,
          document.body
        )
      }
    </div>

  );
}

function isSafeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function VideoEmbed({ url }: { url: string }) {
  const trimmed = url.trim();
  const safeHref = isSafeHttpUrl(trimmed);
  if (safeHref && isDirectVideoUrl(safeHref)) return <FeedVideo url={safeHref} />;
  let embed: string | null = null;
  if (safeHref) {
    try {
      const u = new URL(safeHref);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtube.com" || host === "m.youtube.com") {
        const v = u.searchParams.get("v");
        if (v) embed = `https://www.youtube.com/embed/${v}`;
        else if (u.pathname.startsWith("/shorts/"))
          embed = `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      } else if (host === "youtu.be") {
        embed = `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
      } else if (host === "vimeo.com") {
        const id = u.pathname.split("/").filter(Boolean)[0];
        if (id) embed = `https://player.vimeo.com/video/${id}`;
      }
    } catch {
      /* noop */
    }
  }

  if (embed) {
    return (
      <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          src={embed}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (!safeHref) return null;

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block truncate rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary underline"
    >
      {safeHref}
    </a>
  );
}
