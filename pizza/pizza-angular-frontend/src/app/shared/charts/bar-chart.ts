import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { niceCeiling, observedWidth } from './chart-size';

export interface BarRow {
  label: string;
  value: number;
  /** Shown in the tooltip beneath the value — here, the revenue behind the units. */
  note: string;
}

/**
 * Best sellers, as a horizontal bar chart.
 *
 * <p>Horizontal because the categories are product names: long text reads straight across on a
 * y-axis and has to be rotated on an x-axis.
 *
 * <p>Every bar is the SAME colour. The category is already named on the axis, so colouring each
 * one differently would encode information that is not there — decoration, not data. That is also
 * why there is no colourblind-separation problem to solve on this chart.
 *
 * <p>4px rounded data-end, square against the baseline: the rounding belongs on the end that
 * carries the value, and a rounded baseline would make the bars look like they start above zero.
 */
@Component({
  selector: 'app-bar-chart',
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
        @for (tick of xTicks(); track tick.value) {
          <line class="viz-grid-line" [attr.x1]="tick.x" [attr.x2]="tick.x"
                [attr.y1]="0" [attr.y2]="height() - padBottom" />
          <text class="viz-tick" [attr.x]="tick.x" [attr.y]="height() - padBottom + 16"
                text-anchor="middle">
            {{ tick.value }}
          </text>
        }

        @for (bar of laidOut(); track bar.label) {
          <text class="viz-tick" [attr.x]="labelWidth - 8" [attr.y]="bar.y + barHeight / 2 + 4"
                text-anchor="end">
            {{ bar.short }}
          </text>

          <rect
            [attr.x]="labelWidth"
            [attr.y]="bar.y"
            [attr.width]="bar.width"
            [attr.height]="barHeight"
            rx="4"
            fill="var(--viz-series-1)"
            [attr.fill-opacity]="hoveredLabel() && hoveredLabel() !== bar.label ? 0.55 : 1"
          />
          <!-- Square off the baseline end that rx="4" rounded. -->
          <rect [attr.x]="labelWidth" [attr.y]="bar.y" [attr.width]="4" [attr.height]="barHeight"
                fill="var(--viz-series-1)"
                [attr.fill-opacity]="hoveredLabel() && hoveredLabel() !== bar.label ? 0.55 : 1" />

          <rect
            [attr.x]="labelWidth"
            [attr.y]="bar.y - rowGap / 2"
            [attr.width]="plotWidth()"
            [attr.height]="barHeight + rowGap"
            fill="transparent"
            (mouseenter)="hoveredLabel.set(bar.label)"
            (mouseleave)="hoveredLabel.set(null)"
          />
        }
      </svg>

      @if (hovered(); as bar) {
        <div
          class="viz-tooltip position-absolute"
          [style.left.px]="labelWidth + bar.width + 12"
          [style.top.px]="bar.y"
          style="pointer-events: none"
        >
          <div class="viz-tooltip-label">{{ bar.label }}</div>
          <div class="viz-tooltip-value">{{ bar.value }} units</div>
          <div class="viz-tooltip-label mt-1 mb-0">{{ bar.note }}</div>
        </div>
      }
    </div>
  `,
})
export class BarChart {
  readonly rows = input.required<BarRow[]>();
  readonly ariaLabel = input('Best sellers');

  protected readonly labelWidth = 150;
  protected readonly padRight = 32;
  protected readonly padBottom = 24;
  protected readonly barHeight = 18;
  protected readonly rowGap = 16;

  readonly width = observedWidth(inject(ElementRef));
  readonly hoveredLabel = signal<string | null>(null);

  readonly height = computed(
    () => this.rows().length * (this.barHeight + this.rowGap) + this.padBottom,
  );

  readonly plotWidth = computed(() => this.width() - this.labelWidth - this.padRight);

  private readonly max = computed(() => niceCeiling(Math.max(...this.rows().map((r) => r.value), 1)));

  readonly laidOut = computed(() =>
    this.rows().map((row, index) => ({
      ...row,
      // The axis is only 150px wide; a name longer than that would overlap the bars.
      short: row.label.length > 22 ? `${row.label.slice(0, 21)}…` : row.label,
      y: index * (this.barHeight + this.rowGap) + this.rowGap / 2,
      width: Math.max(4, (row.value / this.max()) * this.plotWidth()),
    })),
  );

  readonly hovered = computed(
    () => this.laidOut().find((b) => b.label === this.hoveredLabel()) ?? null,
  );

  readonly xTicks = computed(() =>
    [0, 0.5, 1].map((fraction) => ({
      value: Math.round(this.max() * fraction),
      x: this.labelWidth + fraction * this.plotWidth(),
    })),
  );
}
