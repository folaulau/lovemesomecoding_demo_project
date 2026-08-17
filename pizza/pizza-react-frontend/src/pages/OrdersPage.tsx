import { useEffect, useState } from 'react';
import { Alert, Badge, Container, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatMoney } from '../lib/money';
import type { Order, OrderStatus, Page } from '../types';

const STATUS_VARIANT: Record<OrderStatus, string> = {
  COMPLETED: 'success',
  PREPARING: 'info',
  PAID: 'primary',
  PENDING_PAYMENT: 'warning',
  CANCELLED: 'secondary',
};

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        // `auth: true` attaches the bearer token — this endpoint is not public.
        const page = await api.get<Page<Order>>('/api/orders/mine?page=0&size=20', {
          auth: true,
          signal: controller.signal,
        });
        setOrders(page.content);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load your orders.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-1">My orders</h1>
      <p className="text-muted">{user?.email}</p>

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" role="status">
            <span className="visually-hidden">Loading…</span>
          </Spinner>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {!loading && !error && orders.length === 0 && (
        <Alert variant="light" className="border text-center">
          You have not placed any orders yet.
        </Alert>
      )}

      {!loading && !error && orders.length > 0 && (
        <Table responsive hover className="bg-white rounded shadow-sm align-middle">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Type</th>
              <th>Status</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link to={`/order-confirmation/${order.id}`} className="font-monospace small">
                    {order.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="small">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="small">{order.orderType.toLowerCase()}</td>
                <td>
                  <Badge bg={STATUS_VARIANT[order.status]}>{order.status.replace('_', ' ')}</Badge>
                </td>
                <td className="text-end">{formatMoney(order.total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
