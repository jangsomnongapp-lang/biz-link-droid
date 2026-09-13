import { useEffect, useRef } from "react";

/**
 * Makes the phone/browser back gesture close an overlay instead of leaving the page.
 * Pushes a throwaway history entry while the overlay is open and removes it on close.
 */
export function useBackClose(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let closedByBack = false;
    window.history.pushState({ overlay: true }, "");

    const onPop = () => {
      closedByBack = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Overlay closed some other way: drop the extra history entry we added.
      if (!closedByBack && window.history.state?.overlay) {
        window.history.back();
      }
    };
  }, []);
}
