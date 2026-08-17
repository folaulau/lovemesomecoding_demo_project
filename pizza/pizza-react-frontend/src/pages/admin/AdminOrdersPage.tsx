import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner, Table } from 'react-bootstrap';
import { adminApi } from '../../lib/adminApi';
import { formatMoney } from '../../lib/money';
import { useToast } from '../../context/ToastContext';
import type { Order, OrderStatus } from '../../types';

const STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PREPARING',
  'COMPLETED',
  'CANCELLED',
];

const STATUS_VARIANT: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'primary',
  PREPARING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'secondary',
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async (pageIndex: number) => {
    setLoading(true);
    try {
      const result = await adminApi.listOrders(pageIndex, 20);
      setOrders(result.content);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  async function changeStatus(order: Order, status: OrderStatus) {
    try {
      await adminApi.updateOrderStatus(order.id, status);
      showToast(`Order moved to ${status.replace('_', ' ').toLowerCase()}`);
      await load(page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update the order', 'danger');
    }
  }

  if (loading && orders.length === 0) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" role="status">
          <span className="visually-hidden">Loading orders…</span>
        </Spinner>
      </div>
    );
  }

  return (
    <>
      <h2 className="h5 fw-bold mb-3">Orders</h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th className="ps-3">Order</th>
                <th>Customer</th>
                <th>Placed</th>
                <th>Type</th>
                <th className="text-end">Total</th>
                <th>Status</th>
                <th className="pe-3">Move to</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="ps-3 font-monospace small">{order.id.slice(0, 8)}…</td>
                  <td>
                    <div className="small fw-semibold">{order.customerName}</div>
                    <div className="text-muted small">{order.email}</div>
                  </td>
                  <td className="small">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="small">{order.orderType.toLowerCase()}</td>
                  <td className="text-end">{formatMoney(order.total)}</td>
                  <td>
                    <Badge bg={STATUS_VARIANT[order.status]}>
                      {order.status.replace('_', ' ').toLowerCase()}
                    </Badge>
                  </td>
                  <td className="pe-3">
                    <Form.Select
                      size="sm"
                      aria-label={`Change status of order ${order.id.slice(0, 8)}`}
                      value={order.status}
                      onChange={(e) => void changeStatus(order, e.target.value as OrderStatus)}
                      style={{ minWidth: '10rem' }}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace('_', ' ').toLowerCase()}
                        </option>
                      ))}
                    </Form.Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="small text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
