// Smooth wheel scrolling for the page (Lenis).
// Touch keeps the platform's own native 120Hz scrolling. Lenis auto-toggles
// whenever the page is scroll-locked behind a sheet, and nested scrollers
// (lyrics, shelves, queues, studio, sidebar) keep their own native wheel.

let activeLenis = null;

export function setLenisInstance(instance) {
  activeLenis = instance;
}

export function getLenisInstance() {
  return activeLenis;
}

// Moves the page at once, cancelling any smooth scroll still under way.
export function jumpTo(top) {
  if (activeLenis) activeLenis.scrollTo(top, { immediate: true, force: true });
  else if (typeof window !== 'undefined') window.scrollTo({ top, behavior: 'instant' });
}

// Smoothly scrolls to target offset respecting prefers-reduced-motion
export function smoothScrollTo(top, { duration = 0.8, onComplete } = {}) {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReduced) {
    jumpTo(top);
    onComplete?.();
    return;
  }
  if (activeLenis) {
    activeLenis.scrollTo(top, { duration, onComplete });
  } else if (typeof window !== 'undefined') {
    window.scrollTo({ top, behavior: 'smooth' });
    if (onComplete) setTimeout(onComplete, Math.round(duration * 1000));
  }
}
