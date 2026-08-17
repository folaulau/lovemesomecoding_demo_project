import { useEffect, useState } from 'react';
import { Alert, Badge, Card, Col, Container, Row, Spinner, Table } from 'react-bootstrap';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import type { Product, ReportDashboard } from '../../types';

/**
 * Admin dashboard.
 *
 * <p>This module is loaded with React.lazy from App.tsx — see the note there. Customers never open
 * this page, so its code (and the charting library Phase 5 will add) should not sit in the bundle
 * that every visitor downloads.
 *
 * <p>Both requests below go to /api/admin/**, which the backend restricts to an ADMIN token. The
 * ProtectedRoute wrapper is only a usability guard; this is where the real enforcement is.
 *
 * <p>Phase 5 turns the numbers below into charts and adds product CRUD.
 */
// A default export is what React.lazy expects.
export default function AdminDashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [report, setReport] = useState<ReportDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [productData, reportData] = await Promise.all([
          api.get<Product[]>('/api/admin/products', { auth: true, signal: controller.signal }),
          api.get<ReportDashboard>('/api/admin/reports/dashboard?days=30', {
            auth: true,
            signal: controller.signal,
          }),
        ]);
        setProducts(productData);
        setReport(reportData);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load admin data.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="danger" role="status">
          <span className="visually-hidden">Loading…</span>
        </Spinner>
      </Container>
    );
  }

  const stats = [
    { label: 'Orders (30d)', value: String(report?.summary.totalOrders ?? 0) },
    { label: 'Revenue (30d)', value: formatMoney(report?.summary.totalRevenue ?? 0) },
    { label: 'Avg order', value: formatMoney(report?.summary.averageOrderValue ?? 0) },
    { label: 'Items sold', value: String(report?.summary.itemsSold ?? 0) },
  ];

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-1">Admin</h1>
      <p className="text-muted">Menu management and reporting — last 30 days.</p>

      {error && <Alert variant="danger">{error}</Alert>}

      <Alert variant="warning">
        Read-only for now. Product CRUD and the charted reports dashboard arrive in Phase 5.
      </Alert>

      <Row xs={2} md={4} className="g-3 mb-4">
        {stats.map((stat) => (
          <Col key={stat.label}>
            <Card className="border-0 shadow-sm text-center h-100">
              <Card.Body>
                <div className="h3 fw-bold text-pizza-red mb-0">{stat.value}</div>
                <div className="text-muted small text-uppercase">{stat.label}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4 mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 fw-bold text-uppercase text-muted mb-3">Top products</h2>
              <Table size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-end">Units</th>
                    <th className="text-end">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.topProducts.map((p) => (
                    <tr key={p.productName}>
                      <td>{p.productName}</td>
                      <td className="text-end">{p.unitsSold}</td>
                      <td className="text-end">{formatMoney(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 fw-bold text-uppercase text-muted mb-3">Orders by status</h2>
              <Table size="sm" className="mb-0">
                <tbody>
                  {report?.statusBreakdown.map((s) => (
                    <tr key={s.status}>
                      <td>
                        <Badge bg="secondary">{s.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="text-end">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <h2 className="h6 fw-bold text-uppercase text-muted mb-3">
            Menu · {products.length} products
          </h2>
          <Table responsive hover size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Active</th>
                <th>Small</th>
                <th>Medium</th>
                <th>Large</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>
                    <Badge bg={product.type === 'PIZZA' ? 'primary' : 'secondary'}>
                      {product.type}
                    </Badge>
                  </td>
                  <td>{product.active ? '✓' : '—'}</td>
                  {(['SMALL', 'MEDIUM', 'LARGE'] as const).map((size) => (
                    <td key={size}>
                      {formatMoney(product.sizes.find((s) => s.size === size)?.price ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
}
