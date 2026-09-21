import { useState } from "react";
import { Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function ProjectRateSheet({
  name,
  onClose,
  onSubmit,
}: {
  name: string;
  onClose: () => void;
  onSubmit: (stars: number, comment: string | null) => Promise<void>;
}) {
  const { lang } = useI18n();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-surface p-5">
        <div className="mb-2 text-base font-bold text-foreground">
          {lang === "km" ? "វាយតម្លៃ" : "Rate"} {name}
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n}`} className="p-0.5 active:scale-95">
              <Star className={`h-8 w-8 ${n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          maxLength={100}
          onChange={(e) => setComment(e.target.value)}
          placeholder={lang === "km" ? "មតិយោបល់ (ស្រេចចិត្ត, ≤១០០តួ)" : "Comment (optional, ≤100 chars)"}
          className="mt-3 h-20 w-full rounded-xl border border-border bg-background p-2 text-sm outline-none"
        />
        <div className="mt-1 text-right text-[10px] text-muted-foreground">{comment.length}/100</div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold">
            {lang === "km" ? "រំលង" : "Skip"}
          </button>
          <button
            type="button"
            onClick={async () => {
              setSubmitting(true);
              await onSubmit(stars, comment.trim() || null);
              setSubmitting(false);
            }}
            disabled={submitting}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {lang === "km" ? "ដាក់ស្នើ" : "Submit rating"}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {lang === "km" ? "ការវាយតម្លៃជាសាធារណៈនៅលើទម្រង់ទាំងពីរ" : "Ratings are public on both profiles"}
        </p>
      </div>
    </div>
  );
}
