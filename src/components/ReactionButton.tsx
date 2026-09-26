import { useRef, useState } from "react";
import { ThumbsUp } from "lucide-react";

export const REACTIONS = [
  { id: "like", emoji: "👍", label: "Like", color: "text-primary" },
  { id: "love", emoji: "❤️", label: "Love", color: "text-red-500" },
  { id: "haha", emoji: "😂", label: "Haha", color: "text-amber-500" },
  { id: "wow", emoji: "😮", label: "Wow", color: "text-amber-500" },
  { id: "sad", emoji: "😢", label: "Sad", color: "text-amber-500" },
] as const;

export type ReactionId = (typeof REACTIONS)[number]["id"];

export function reactionMeta(id: string | null | undefined) {
  return REACTIONS.find((r) => r.id === id) ?? null;
}

interface Props {
  /** current user's reaction, null when not reacted */
  mine: ReactionId | null;
  onReact: (reaction: ReactionId | null) => void;
  label: string;
}

/**
 * Facebook-style reaction button: tap toggles Like, press-and-hold opens
 * the 5-reaction picker. Uses pointer events so it works on touch + mouse.
 */
export function ReactionButton({ mine, onReact, label }: Props) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  function clear() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown() {
    held.current = false;
    clear();
    timer.current = setTimeout(() => {
      held.current = true;
      setOpen(true);
    }, 450);
  }

  function onPointerUp() {
    clear();
    if (held.current) return; // picker is open; selection happens there
    // simple tap: toggle like
    onReact(mine ? null : "like");
  }

  function pick(r: ReactionId) {
    setOpen(false);
    held.current = false;
    onReact(r);
  }

  const meta = reactionMeta(mine);

  return (
    <div className="relative flex-1">
      {open && (
        <>
          <button
            aria-label="close reactions"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            {REACTIONS.map((r) => (
              <button
                key={r.id}
                aria-label={r.label}
                onClick={() => pick(r.id)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 active:scale-110 ${
                  mine === r.id ? "bg-muted ring-1 ring-primary" : ""
                }`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={clear}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex w-full select-none items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium active:bg-muted ${
          meta ? meta.color : "text-muted-foreground"
        }`}
      >
        {meta ? (
          <span className="text-sm leading-none">{meta.emoji}</span>
        ) : (
          <ThumbsUp className="h-4 w-4" />
        )}
        {meta ? meta.label : label}
      </button>
    </div>
  );
}
