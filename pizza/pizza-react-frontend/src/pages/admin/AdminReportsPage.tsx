import { useEffect } from 'react';
import { Alert, ButtonGroup, Card, Col, Container, Row, Spinner, Table } from 'react-bootstrap';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '../../lib/money';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchDashboard,
  rangeChanged,
  selectCurrentReport,
  selectDays,
  selectReportsError,
  selectReportsLoading,
} from '../../store/reportsSlice';

const RANGES = [7, 30, 90] as const;

/** 2026-08-15 -> "Aug 15". Short labels keep the x-axis from colliding. */
function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * A tooltip in our own markup rather than Recharts' default.
 *
 * An HTML chart is interactive by nature, so a hover layer is the default, not an extra. Values
 * live in text tokens; the series colour identifies the mark beside them, never the text itself.
 */
function VizTooltip({
  active,
  payload,
  label,
  format,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: Record<string, unknown> }>;
  label?: string | number;
  format?: (value: number) => string;
  suffix?: (row: Record<string, unknown>) => string | null;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const extra = suffix?.(point.payload);

  return (
    <div className="viz-tooltip">
      <div className="viz-tooltip-label">{label}</div>
      <div className="viz-tooltip-value">
        {format ? format(point.value) : point.value}
      </div>
      {extra && <div className="viz-tooltip-label mt-1 mb-0">{extra}</div>}
    </div>
  );
}

export default function AdminReportsPage() {
  const dispatch = useAppDispatch();
  const days = useAppSelector(selectDays);
  const report = useAppSelector(selectCurrentReport);
  const loading = useAppSelector(selectReportsLoading);
  const error = useAppSelector(selectReportsError);

  /*
   * The whole `let cancelled = false` dance this replaced existed to stop a slow response for the
   * OLD range from overwriting a newer one. The slice files each response under the range it was
   * requested for (action.meta.arg), so a late arrival lands in the right slot and is simply not
   * the one being displayed. Out-of-order responses stop being a race and become a non-event.
   *
   * Refetching on every visit even when cached is deliberate: the tab shows what is already known
   * immediately, then quietly corrects it. Instant AND current, rather than one or the other.
   */
  useEffect(() => {
    void dispatch(fetchDashboard(days));
  }, [dispatch, days]);

  if (loading && !report) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" role="status">
          <span className="visually-hidden">Loading reports…</span>
        </Spinner>
      </div>
    );
  }

  // Only surrender the screen to an error if there is nothing cached to show. A failed background
  // refresh should not wipe out a report the admin is already reading.
  if (error && !report) return <Alert variant="danger">{error}</Alert>;
  if (!report) return null;

  const { summary, revenueByDay, topProducts, statusBreakdown } = report;

  /*
   * Headline numbers are NOT a chart. Four values with no relationship to plot are read fastest as
   * text — putting them in a bar chart would add ink without adding meaning.
   */
  const tiles = [
    { label: 'Orders', value: String(summary.totalOrders) },
    { label: 'Revenue', value: formatMoney(summary.totalRevenue) },
    { label: 'Avg order', value: formatMoney(summary.averageOrderValue) },
    { label: 'Items sold', value: String(summary.itemsSold) },
  ];

  const chartData = revenueByDay.map((d) => ({ ...d, label: shortDay(d.day) }));

  return (
    <Container fluid className="px-0 viz-root">
      {/* Filters sit in one row above the charts, per the interaction spec. */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 className="h5 fw-bold mb-0">Sales reports</h2>
        <ButtonGroup size="sm" aria-label="Report time range">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              className={`btn btn-outline-primary${days === range ? ' active' : ''}`}
              aria-pressed={days === range}
              onClick={() => dispatch(rangeChanged(range))}
            >
              {range} days
            </button>
          ))}
        </ButtonGroup>
      </div>

      <Row xs={2} md={4} className="g-3 mb-4" data-testid="stat-tiles">
        {tiles.map((tile) => (
          <Col key={tile.label}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <div className="text-muted small text-uppercase">{tile.label}</div>
                <div className="h3 fw-bold mb-0" style={{ color: 'var(--viz-text-primary)' }}>
                  {tile.value}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ---------------------------------------------------------------- revenue over time */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          {/*
            One series, so the title names it and no legend box is needed. Two measures are
            available (orders and revenue) but they are NEVER put on two y-axes — a dual-axis
            chart invents correlations. Order count rides along in the tooltip instead.
          */}
          <h3 className="h6 fw-bold mb-1">Revenue per day</h3>
          <p className="text-muted small mb-3">Paid, preparing and completed orders.</p>

          {chartData.length === 0 ? (
            <p className="text-muted small mb-0">No orders in this window.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--viz-text-secondary)', fontSize: 12 }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: 'var(--viz-text-secondary)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  content={
                    <VizTooltip
                      format={(v) => formatMoney(v)}
                      suffix={(row) => `${row.orders as number} orders`}
                    />
                  }
                  cursor={{ stroke: 'var(--viz-grid)', strokeWidth: 1 }}
                />
                {/*
                  2px line, 8px active marker — thin marks, generous hit targets.

                  isAnimationActive={false} on purpose. A dashboard re-renders on every filter
                  change and re-animating each time is noise, not delight. It also makes the chart
                  deterministic: with animation on, anything that re-measures the container (a
                  resize, or a full-page screenshot) restarts the draw and can capture the marks
                  at zero progress — which looks exactly like a broken chart.

                  type="linear", not a smoothed curve: these are DAILY totals, and a spline would
                  draw revenue values between the days that never existed.
                */}
                <Line
                  type="linear"
                  dataKey="revenue"
                  stroke="var(--viz-series-1)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={{ r: 4, fill: 'var(--viz-series-1)', strokeWidth: 0 }}
                  activeDot={{ r: 6, stroke: 'var(--viz-surface)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card.Body>
      </Card>

      <Row className="g-4">
        {/* ------------------------------------------------------------ top products */}
        <Col lg={7}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h3 className="h6 fw-bold mb-1">Best sellers</h3>
              <p className="text-muted small mb-3">Units sold in the selected window.</p>

              {topProducts.length === 0 ? (
                <p className="text-muted small mb-0">Nothing sold in this window.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, topProducts.length * 34)}>
                  <BarChart
                    data={topProducts}
                    layout="vertical"
                    margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
                    barCategoryGap={6}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--viz-text-secondary)', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    {/* The category is named on the axis — colouring each bar would add nothing. */}
                    <YAxis
                      type="category"
                      dataKey="productName"
                      width={150}
                      tick={{ fill: 'var(--viz-text-secondary)', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={
                        <VizTooltip
                          format={(v) => `${v} units`}
                          suffix={(row) => formatMoney(row.revenue as number)}
                        />
                      }
                      cursor={{ fill: 'var(--viz-grid)', fillOpacity: 0.4 }}
                    />
                    {/* 4px rounded data-end, anchored square to the baseline. */}
                    <Bar
                      dataKey="unitsSold"
                      fill="var(--viz-series-1)"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={18}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* ------------------------------------------------------------ status breakdown */}
        <Col lg={5}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h3 className="h6 fw-bold mb-1">Orders by status</h3>
              <p className="text-muted small mb-3">Every order in the window, paid or not.</p>

              {/*
                A table, not a pie. Five labelled counts are read more precisely as numbers, and it
                doubles as the accessible view of the data — no information is carried by colour
                alone anywhere on this page.
              */}
              <Table size="sm" className="mb-0">
                <thead className="visually-hidden">
                  <tr>
                    <th>Status</th>
                    <th>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {statusBreakdown.map((row) => {
                    const max = Math.max(...statusBreakdown.map((r) => r.count));
                    return (
                      <tr key={row.status}>
                        <td className="text-muted small" style={{ width: '45%' }}>
                          {row.status.replace('_', ' ').toLowerCase()}
                        </td>
                        <td>
                          {/* An inline bar keeps the comparison visual without a second chart. */}
                          <div className="d-flex align-items-center gap-2">
                            <div
                              style={{
                                height: 10,
                                borderRadius: 4,
                                background: 'var(--viz-series-1)',
                                width: `${Math.max(6, (row.count / max) * 100)}%`,
                              }}
                            />
                            <span className="small fw-bold">{row.count}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
