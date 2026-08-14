import { useEffect, type RefObject } from 'react';

/**
 * Auto-scrolls while any native HTML5 drag is in progress and the pointer is
 * near the top/bottom edge — browsers don't do this on their own, which
 * makes reordering/nesting across a long list impossible without it (you
 * can't drag far enough to reach an off-screen target). Listens globally
 * (dragstart/dragend/dragover bubble from any draggable element), so a
 * single call covers every drag interaction on the page.
 *
 * Pass `containerRef` to scroll a specific scrollable panel (e.g. a sidebar
 * with its own `overflow-y-auto`) instead of the window — scrolling the
 * window does nothing for a `position: sticky` panel that has its own
 * internal scroll, so this checks the pointer against that element's own
 * bounds and scrolls its `scrollTop` instead.
 */
export function useAutoScrollOnDrag(containerRef?: RefObject<HTMLElement | null>, threshold = 90, maxSpeed = 22) {
  useEffect(() => {
    let dragging = false;
    let clientY = 0;
    let rafId: number;

    function tick() {
      if (dragging) {
        const el = containerRef?.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const top = Math.max(rect.top, 0);
          const bottom = Math.min(rect.bottom, window.innerHeight);
          if (clientY >= top && clientY <= bottom) {
            if (clientY - top < threshold) {
              el.scrollTop -= maxSpeed * (1 - (clientY - top) / threshold);
            } else if (bottom - clientY < threshold) {
              el.scrollTop += maxSpeed * (1 - (bottom - clientY) / threshold);
            }
          }
        } else {
          const h = window.innerHeight;
          if (clientY < threshold) {
            window.scrollBy(0, -maxSpeed * (1 - clientY / threshold));
          } else if (clientY > h - threshold) {
            window.scrollBy(0, maxSpeed * (1 - (h - clientY) / threshold));
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    function onDragStart() { dragging = true; }
    function onDragEnd() { dragging = false; }
    function onDragOver(e: DragEvent) { clientY = e.clientY; }

    window.addEventListener('dragstart', onDragStart);
    window.addEventListener('dragend', onDragEnd);
    window.addEventListener('dragover', onDragOver);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('dragend', onDragEnd);
      window.removeEventListener('dragover', onDragOver);
      cancelAnimationFrame(rafId);
    };
  }, [containerRef, threshold, maxSpeed]);
}
