import { Alert, Badge, Card, Col, Container, Row, Table } from 'react-bootstrap';
import { MOCK_CRUSTS, MOCK_DRINKS, MOCK_PIZZAS, MOCK_TOPPINGS } from '../../mocks/menu';
import { formatMoney } from '../../lib/money';

/**
 * Admin dashboard.
 *
 * This module is loaded with React.lazy from App.tsx — see the note there. Customers never open
 * this page, so its code (and the charting library Phase 5 will add) should not sit in the bundle
 * that every visitor downloads.
 *
 * Phase 5 turns this read-only view into real CRUD plus the reports dashboard.
 */
// A default export is what React.lazy expects.
export default function AdminDashboardPage() {
  const stats = [
    { label: 'Pizzas', value: MOCK_PIZZAS.length },
    { label: 'Drinks', value: MOCK_DRINKS.length },
    { label: 'Toppings', value: MOCK_TOPPINGS.length },
    { label: 'Crusts', value: MOCK_CRUSTS.length },
  ];

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-1">Admin</h1>
      <p className="text-muted">Menu management and reporting.</p>

      <Alert variant="warning">
        Read-only preview. Product CRUD and the reports dashboard arrive in Phase 5, once the
        backend endpoints exist.
      </Alert>

      <Row xs={2} md={4} className="g-3 mb-4">
        {stats.map((stat) => (
          <Col key={stat.label}>
            <Card className="border-0 shadow-sm text-center">
              <Card.Body>
                <div className="display-6 fw-bold text-pizza-red">{stat.value}</div>
                <div className="text-muted small text-uppercase">{stat.label}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <h2 className="h6 fw-bold text-uppercase text-muted mb-3">Menu</h2>
          <Table responsive hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Small</th>
                <th>Medium</th>
                <th>Large</th>
              </tr>
            </thead>
            <tbody>
              {[...MOCK_PIZZAS, ...MOCK_DRINKS].map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>
                    <Badge bg={product.type === 'PIZZA' ? 'primary' : 'secondary'}>
                      {product.type}
                    </Badge>
                  </td>
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
