import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw, Check } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  successMessage?: string;
  threshold?: number;
}

type Phase = "idle" | "pulling" | "refreshing" | "done";

/**
 * Mobile-style pull-to-refresh wrapper.
 * - Elastic drag from top when window scrollY === 0
 * - Spring release, circular loader, success toast
 * - Ignores horizontal gestures (avoids fighting carousels)
 */
export function PullToRefresh({
  onRefresh,
  children,
  successMessage = "Everything is up to date",
  threshold = 72,
}: PullToRefreshProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pull, setPull] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const locked = useRef<"v" | "h" | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (phase === "refreshing") return;
      if (window.scrollY > 0) return;
      const t = e.touches[0];
      startY.current = t.clientY;
      startX.current = t.clientX;
      locked.current = null;
      pulling.current = true;
    }
    function onTouchMove(e: TouchEvent) {
      if (!pulling.current || startY.current === null || startX.current === null) return;
      const t = e.touches[0];
      const dy = t.clientY - startY.current;
      const dx = t.clientX - startX.current;
      if (locked.current === null) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
          locked.current = "h";
          pulling.current = false;
          return;
        }
        if (dy > 6) locked.current = "v";
      }
      if (locked.current !== "v") return;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      // Elastic resistance
      const resisted = Math.pow(dy, 0.85);
      setPull(Math.min(resisted, 140));
      setPhase("pulling");
      if (e.cancelable) e.preventDefault();
    }
    async function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      const reached = pull >= threshold;
      startY.current = null;
      startX.current = null;
      if (reached && phase !== "refreshing") {
        setPhase("refreshing");
        setPull(56);
        // Haptic feedback if available
        try {
          (navigator as Navigator & { vibrate?: (p: number) => void }).vibrate?.(12);
        } catch {
          /* noop */
        }
        try {
          await onRefresh();
        } finally {
          setPhase("done");
          setShowToast(true);
          setPull(0);
          setTimeout(() => setShowToast(false), 1800);
          setTimeout(() => setPhase("idle"), 400);
        }
      } else {
        setPull(0);
        setPhase("idle");
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [phase, pull, threshold, onRefresh]);

  const progress = Math.min(pull / threshold, 1);
  const isActive = phase === "pulling" || phase === "refreshing";

  return (
    <>
      {/* Drag indicator */}
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex justify-center"
        style={{
          transform: `translateY(${isActive ? Math.min(pull, 100) - 40 : -60}px)`,
          transition: phase === "pulling" ? "none" : "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          opacity: isActive ? 1 : 0,
        }}
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-lg ring-1 ring-black/5"
          style={{
            transform: `scale(${0.7 + progress * 0.3})`,
          }}
        >
          {phase === "refreshing" ? (
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-primary"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 9}`}
                strokeDashoffset={`${2 * Math.PI * 9 * (1 - progress)}`}
                style={{ transition: "stroke-dashoffset 80ms linear" }}
              />
            </svg>
          )}
        </div>
      </div>

      {/* Content with elastic translation */}
      <div
        style={{
          transform: isActive ? `translateY(${Math.min(pull, 100)}px)` : "translateY(0)",
          transition: phase === "pulling" ? "none" : "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
      >
        {children}
      </div>

      {/* Floating success toast */}
      <div
        className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4"
        style={{
          transform: showToast ? "translateY(0)" : "translateY(-20px)",
          opacity: showToast ? 1 : 0,
          transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms",
        }}
      >
        <div className="flex items-center gap-2 rounded-full bg-foreground/90 px-4 py-2 text-sm font-medium text-background shadow-xl backdrop-blur">
          <Check className="h-4 w-4 text-success" />
          {successMessage}
        </div>
      </div>
    </>
  );
}
