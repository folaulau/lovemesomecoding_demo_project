import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { formatMoney } from '../../../core/money';
import { HumanisePipe } from '../../../core/money.pipe';
import { BarChart, type BarRow } from '../../../shared/charts/bar-chart';
import { LineChart, type LinePoint } from '../../../shared/charts/line-chart';
import { Spinner } from '../../../shared/spinner/spinner';
import { ReportsActions, reportsFeature } from '../../store/reports.store';

const RANGES = [7, 30, 90];

/** 2026-08-15 -> "Aug 15". Short labels keep the x-axis from colliding. */
function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

@Component({
  selector: 'app-admin-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChart, BarChart, Spinner, HumanisePipe],
  templateUrl: './admin-reports.html',
})
export class AdminReports {
  private readonly store = inject(Store);

  readonly ranges = RANGES;

  readonly days = this.store.selectSignal(reportsFeature.selectDays);
  readonly report = this.store.selectSignal(reportsFeature.selectCurrentReport);
  readonly loading = this.store.selectSignal(reportsFeature.selectLoading);
  readonly error = this.store.selectSignal(reportsFeature.selectError);

  constructor() {
    /*
     * Load once on arrival, and again whenever the range changes — an effect turns `rangeChanged`
     * into a load, so the buttons dispatch one action rather than two in the right order.
     *
     * Fetching again even when the range is already cached is deliberate: the tab shows what is
     * already known immediately, then quietly corrects it. Instant AND current, rather than one or
     * the other.
     */
    this.store.dispatch(ReportsActions.load({ days: this.days() }));
  }

  setRange(days: number): void {
    this.store.dispatch(ReportsActions.rangeChanged({ days }));
  }

  /*
   * Headline numbers are NOT a chart. Four values with no relationship to plot are read fastest as
   * text — putting them in a bar chart would add ink without adding meaning.
   */
  readonly tiles = computed(() => {
    const summary = this.report()?.summary;
    if (!summary) return [];

    return [
      { label: 'Orders', value: String(summary.totalOrders) },
      { label: 'Revenue', value: formatMoney(summary.totalRevenue) },
      { label: 'Avg order', value: formatMoney(summary.averageOrderValue) },
      { label: 'Items sold', value: String(summary.itemsSold) },
    ];
  });

  readonly revenuePoints = computed<LinePoint[]>(() =>
    (this.report()?.revenueByDay ?? []).map((day) => ({
      label: shortDay(day.day),
      value: day.revenue,
      note: `${day.orders} orders`,
    })),
  );

  readonly topProducts = computed<BarRow[]>(() =>
    (this.report()?.topProducts ?? []).map((row) => ({
      label: row.productName,
      value: row.unitsSold,
      note: formatMoney(row.revenue),
    })),
  );

  readonly statusBreakdown = computed(() => {
    const rows = this.report()?.statusBreakdown ?? [];
    const max = Math.max(...rows.map((r) => r.count), 1);
    return rows.map((row) => ({ ...row, width: Math.max(6, (row.count / max) * 100) }));
  });
}
