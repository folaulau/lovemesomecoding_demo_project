import { Badge, Container, Table } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/money';

/** Placeholder order history. Phase 4 replaces this with GET /api/orders/mine. */
const MOCK_HISTORY = [
  { id: 1013, date: '2026-08-15', status: 'COMPLETED', total: 32.18 },
  { id: 1011, date: '2026-08-09', status: 'COMPLETED', total: 54.16 },
  { id: 1008, date: '2026-08-03', status: 'COMPLETED', total: 30.19 },
];

const STATUS_VARIANT: Record<string, string> = {
  COMPLETED: 'success',
  PREPARING: 'info',
  PAID: 'primary',
  PENDING_PAYMENT: 'warning',
  CANCELLED: 'secondary',
};

export function OrdersPage() {
  const { user } = useAuth();

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-1">My orders</h1>
      <p className="text-muted">{user?.email}</p>

      <Table responsive hover className="bg-white rounded shadow-sm">
        <thead>
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Status</th>
            <th className="text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_HISTORY.map((order) => (
            <tr key={order.id}>
              <td>#{order.id}</td>
              <td>{order.date}</td>
              <td>
                <Badge bg={STATUS_VARIANT[order.status] ?? 'secondary'}>{order.status}</Badge>
              </td>
              <td className="text-end">{formatMoney(order.total)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}
