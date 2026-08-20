import { DestroyRef, ElementRef, Signal, WritableSignal, afterNextRender, inject, signal } from '@angular/core';

/**
 * Tracks the rendered width of an element as a signal.
 *
 * <p>Recharts gives the React app a `<ResponsiveContainer>` that does this. Rather than add a chart
 * library to the Angular build for two charts, both of them draw their own SVG — and an SVG needs
 * to be told how wide it is, because `width="100%"` on a viewBox either distorts the type or forces
 * the height to scale with it.
 *
 * <p>`ResizeObserver` is the platform's answer and fires on any layout change, not just a window
 * resize — which matters here, because the admin tabs change the container width without the
 * window moving at all.
 *
 * <p>Must be called from an injection context (a field initialiser or a constructor).
 */
export function observedWidth(host: ElementRef<HTMLElement>, fallback = 640): Signal<number> {
  const width: WritableSignal<number> = signal(fallback);
  const destroyRef = inject(DestroyRef);

  afterNextRender(() => {
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) width.set(next);
    });

    observer.observe(host.nativeElement);
    destroyRef.onDestroy(() => observer.disconnect());
  });

  return width.asReadonly();
}

/** 137 -> 150, 1_240 -> 1_500. Axis ticks land on numbers a human would have chosen. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / (magnitude / 2)) * (magnitude / 2);
}
