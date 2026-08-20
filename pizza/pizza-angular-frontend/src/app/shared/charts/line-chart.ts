import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { formatMoney } from '../../core/money';
import { niceCeiling, observedWidth } from './chart-size';

export interface LinePoint {
  label: string;
  value: number;
  /** A second measure shown only in the tooltip — never on a second y-axis. See below. */
  note: string;
}

/**
 * Revenue over time.
 *
 * <p>ONE series, so the card title names it and no legend box is needed. Two measures are available
 * (orders and revenue) but they are never put on two y-axes — a dual-axis chart invents
 * correlations that are not in the data. The order count rides along in the tooltip instead.
 *
 * <p>Straight segments, not a spline: these are DAILY totals, and a smoothed curve would draw
 * revenue values between the days that never existed.
 *
 * <p>No entry animation, deliberately. A dashboard re-renders on every filter change and
 * re-animating each time is noise rather than delight. It also makes the chart deterministic —
 * with animation on, anything that re-measures the container (a resize, or a full-page screenshot)
 * restarts the draw and can capture the marks at zero progress, which looks exactly like a broken
 * chart.
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*
   * ⚠️ A custom element is `display: inline` by default, and `ResizeObserver` then reports the
   * width of the CONTENT rather than of the space available. The chart drew itself at roughly half
   * the card's width and looked like a layout bug in Bootstrap. One line fixes it, and it has to be
   * here rather than in the parent's stylesheet, because the measurement is this component's job.
   */
  styles: ':host { display: block; }',
  template: `
    <div class="position-relative">
      <svg
        [attr.width]="width()"
        [attr.height]="height()"
        [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <!-- Horizontal gridlines only: the x-axis is categorical, so vertical rules add ink
             without adding a reference anyone reads against. -->
        @for (tick of yTicks(); track tick.value) {
          <line class="viz-grid-line" [attr.x1]="padLeft" [attr.x2]="width() - padRight"
                [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="viz-tick" [attr.x]="padLeft - 8" [attr.y]="tick.y + 4" text-anchor="end">
            {{ tick.label }}
          </text>
        }

        <!-- The hovered band sits under the marks, so it never dims the line it is explaining. -->
        @if (hovered(); as point) {
          <rect
            class="viz-hover-band"
            [attr.x]="point.x - bandWidth() / 2"
            [attr.y]="padTop"
            [attr.width]="bandWidth()"
            [attr.height]="plotHeight()"
          />
        }

        <line class="viz-axis-line" [attr.x1]="padLeft" [attr.x2]="width() - padRight"
              [attr.y1]="height() - padBottom" [attr.y2]="height() - padBottom" />

        @for (tick of xTicks(); track tick.x) {
          <!-- The final label is anchored to its END, or half of it hangs off the right edge. -->
          <text class="viz-tick" [attr.x]="tick.x" [attr.y]="height() - padBottom + 16"
                [attr.text-anchor]="tick.anchor">
            {{ tick.label }}
          </text>
        }

        <!-- 2px line, 4px dots, 6px on hover — thin marks, generous hit targets. -->
        <polyline
          [attr.points]="polyline()"
          fill="none"
          stroke="var(--viz-series-1)"
          stroke-width="2"
          stroke-linejoin="round"
        />

        @for (point of laidOut(); track point.label) {
          <circle [attr.cx]="point.x" [attr.cy]="point.y" [attr.r]="point === hovered() ? 6 : 4"
                  fill="var(--viz-series-1)" />
        }

        <!--
          One transparent rectangle per point, covering the full plot height. The hit target is the
          whole column rather than the 4px dot, so the tooltip appears wherever the pointer is
          vertically — the behaviour a chart library gives you and the thing most hand-rolled charts
          get wrong.
        -->
        @for (point of laidOut(); track point.label) {
          <rect
            [attr.x]="point.x - bandWidth() / 2"
            [attr.y]="padTop"
            [attr.width]="bandWidth()"
            [attr.height]="plotHeight()"
            fill="transparent"
            (mouseenter)="hoveredLabel.set(point.label)"
            (mouseleave)="hoveredLabel.set(null)"
          />
        }
      </svg>

      @if (hovered(); as point) {
        <div
          class="viz-tooltip position-absolute"
          [style.left.px]="point.x"
          [style.top.px]="point.y - 12"
          style="transform: translate(-50%, -100%); pointer-events: none"
        >
          <div class="viz-tooltip-label">{{ point.label }}</div>
          <div class="viz-tooltip-value">{{ point.formatted }}</div>
          <div class="viz-tooltip-label mt-1 mb-0">{{ point.note }}</div>
        </div>
      }
    </div>
  `,
})
export class LineChart {
  readonly points = input.required<LinePoint[]>();
  readonly height = input(260);
  readonly ariaLabel = input('Revenue per day');

  protected readonly padLeft = 56;
  protected readonly padRight = 16;
  protected readonly padTop = 8;
  protected readonly padBottom = 24;

  /** The rendered width, so the SVG can be laid out in real pixels rather than a scaled viewBox. */
  readonly width = observedWidth(inject(ElementRef));

  readonly hoveredLabel = signal<string | null>(null);

  private readonly max = computed(() =>
    niceCeiling(Math.max(...this.points().map((p) => p.value), 1)),
  );

  readonly plotHeight = computed(() => this.height() - this.padTop - this.padBottom);
  private readonly plotWidth = computed(() => this.width() - this.padLeft - this.padRight);

  readonly bandWidth = computed(() => this.plotWidth() / Math.max(this.points().length, 1));

  /** Every point with its pixel position and its formatted value, computed once per change. */
  readonly laidOut = computed(() => {
    const points = this.points();
    const lastIndex = Math.max(points.length - 1, 1);

    return points.map((point, index) => ({
      ...point,
      formatted: formatMoney(point.value),
      x: this.padLeft + (index / lastIndex) * this.plotWidth(),
      y: this.padTop + (1 - point.value / this.max()) * this.plotHeight(),
    }));
  });

  readonly polyline = computed(() =>
    this.laidOut()
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  readonly hovered = computed(
    () => this.laidOut().find((p) => p.label === this.hoveredLabel()) ?? null,
  );

  readonly yTicks = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
      value: fraction,
      label: `$${Math.round(this.max() * fraction)}`,
      y: this.padTop + (1 - fraction) * this.plotHeight(),
    })),
  );

  /**
   * Thin the x labels until they stop colliding.
   *
   * A 90-day range has 90 dates and room for perhaps a dozen, so every nth label is drawn. Rotating
   * them instead would keep all 90 and make none of them readable.
   */
  readonly xTicks = computed(() => {
    const laidOut = this.laidOut();
    const step = Math.max(1, Math.ceil(laidOut.length / Math.floor(this.plotWidth() / 64)));

    return laidOut
      .map((point, index) => ({
        ...point,
        anchor: index === laidOut.length - 1 ? 'end' : ('middle' as const),
      }))
      .filter((_, index) => index % step === 0 || index === laidOut.length - 1);
  });
}
