/**
 * Dev-only runtime audit: detects when a `position: fixed` overlay
 * ends up clipped by an ancestor that has become a containing block
 * (transform / will-change / filter / perspective / contain:paint).
 *
 * A correctly-fixed overlay is positioned relative to the viewport,
 * so its bounding rect should overlap the viewport. If an ancestor
 * creates a containing block, the "fixed" element is anchored to
 * that ancestor instead — often ending up offscreen or clipped after
 * page transitions or pull-to-refresh gestures.
 *
 * We log after page transitions and after any pull gesture ends.
 */

const CB_PROPS = ["transform", "willChange", "filter", "perspective", "contain"] as const;

function ancestorContainingBlock(el: Element): HTMLElement | null {
  let node: Element | null = el.parentElement;
  while (node && node !== document.body) {
    const cs = getComputedStyle(node);
    if (
      (cs.transform && cs.transform !== "none") ||
      (cs.willChange && /transform|opacity|filter|perspective/.test(cs.willChange)) ||
      (cs.filter && cs.filter !== "none") ||
      (cs.perspective && cs.perspective !== "none") ||
      /paint|layout|strict/.test(cs.contain || "")
    ) {
      return node as HTMLElement;
    }
    node = node.parentElement;
  }
  return null;
}

function auditFixedOverlays(reason: string) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const all = document.querySelectorAll<HTMLElement>("*");
  const offenders: Array<{ el: HTMLElement; rect: DOMRect; cb: HTMLElement | null }> = [];

  all.forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed") return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const outside =
      rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw;
    const cb = ancestorContainingBlock(el);
    if (outside || cb) {
      offenders.push({ el, rect, cb });
    }
  });

  if (!offenders.length) return;

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[fixed-overlay-audit] ${reason}: ${offenders.length} suspicious fixed element(s)`,
    "color:#e67e22;font-weight:bold",
  );
  offenders.forEach(({ el, rect, cb }) => {
    // eslint-disable-next-line no-console
    console.log(
      {
        element: el,
        rect: { top: rect.top, left: rect.left, w: rect.width, h: rect.height },
        viewport: { w: vw, h: vh },
        offscreen:
          rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw,
        trappedBy: cb,
        trappedByReason: cb
          ? Object.fromEntries(
              CB_PROPS.map((p) => [p, getComputedStyle(cb)[p as never] as string]),
            )
          : null,
      },
    );
  });
  // eslint-disable-next-line no-console
  console.groupEnd();
}

let installed = false;

export function installFixedOverlayAudit() {
  if (installed) return;
  if (typeof window === "undefined") return;
  if (!import.meta.env.DEV) return;
  installed = true;

  const schedule = (reason: string, delay = 450) => {
    window.setTimeout(() => auditFixedOverlays(reason), delay);
  };

  // Page transitions — TanStack Router changes the URL; audit after animation settles.
  let lastPath = window.location.pathname;
  const checkPath = () => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      schedule(`route change → ${lastPath}`);
    }
  };
  // popstate + a light polling fallback for pushState/replaceState
  window.addEventListener("popstate", checkPath);
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args: Parameters<typeof origPush>) {
    const r = origPush.apply(this, args);
    queueMicrotask(checkPath);
    return r;
  };
  history.replaceState = function (...args: Parameters<typeof origReplace>) {
    const r = origReplace.apply(this, args);
    queueMicrotask(checkPath);
    return r;
  };

  // Pull-to-refresh / any touch gesture end — audit shortly after release.
  window.addEventListener(
    "touchend",
    () => schedule("touchend", 600),
    { passive: true },
  );
  window.addEventListener(
    "touchcancel",
    () => schedule("touchcancel", 600),
    { passive: true },
  );
}
