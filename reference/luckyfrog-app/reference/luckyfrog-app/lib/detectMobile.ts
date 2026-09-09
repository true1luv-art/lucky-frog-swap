/**
 * detectMobile — phaserv1
 * Mirrors phaser/lib/detectMobile.ts so phaserv1 UI components
 * have no cross-folder dependency on the old phaser/ folder.
 */

const MOBILE_WIDTH_THRESHOLD = 900

export function detectMobile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  if ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) return true

  const coarse = window.matchMedia?.('(pointer:coarse)')
  if (coarse?.matches) return true

  if (window.innerWidth <= MOBILE_WIDTH_THRESHOLD) return true

  const ua = navigator.userAgent
  return (
    /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(ua) ||
    /\b(Android|Windows Phone|iPad|iPod)\b/i.test(ua)
  )
}
