const MOBILE_WIDTH_THRESHOLD = 900;

/**
 * Plain (hook-free) browser device check. Safe to import from both server and
 * client modules because it has no React dependencies and only touches browser
 * globals when actually invoked at runtime.
 */
export function detectMobile() {
  if (typeof navigator === "undefined") {
    return false;
  }

  if ("maxTouchPoints" in navigator && navigator.maxTouchPoints > 0) {
    return true;
  }

  const coarse = matchMedia("(pointer:coarse)");
  if (coarse?.matches) {
    return true;
  }

  if (typeof window !== "undefined" && window.innerWidth <= MOBILE_WIDTH_THRESHOLD) {
    return true;
  }

  const UA = navigator.userAgent;
  return (
    /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) ||
    /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA)
  );
}
