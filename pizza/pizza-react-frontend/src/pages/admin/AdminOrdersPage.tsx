import { useEffect } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner, Table } from 'react-bootstrap';
import { formatMoney } from '../../lib/money';
import { useToast } from '../../context/ToastContext';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  changeOrderStatus,
  fetchOrders,
  pageChanged,
  selectOrdersState,
} from '../../store/ordersSlice';
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
  const { showToast } = useToast();

  /*
   * REDUX CONCEPT: useSelector subscribes; useDispatch does not.
   *
   * This component re-renders when the slice it selects changes, and NOT when an unrelated slice
   * does. Compare the six useState calls this replaced — the same state, but scattered across the
   * component and gone the moment it unmounted.
   */
  const dispatch = useAppDispatch();
  const { items: orders, page, totalPages, loading, error } = useAppSelector(selectOrdersState);

  useEffect(() => {
    void dispatch(fetchOrders(page));
  }, [dispatch, page]);

  async function changeStatus(order: Order, status: OrderStatus) {
    /*
     * `unwrap()` re-throws the thunk's rejection so this can be written as a normal try/catch.
     * Without it, dispatch RESOLVES even for a rejected thunk — it hands back the action object —
     * and the catch below would never run, silently reporting failures as successes.
     */
    try {
      await dispatch(changeOrderStatus({ id: order.id, status })).unwrap();
      showToast(`Order moved to ${status.replace('_', ' ').toLowerCase()}`);
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
            onClick={() => dispatch(pageChanged(page - 1))}
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
            onClick={() => dispatch(pageChanged(page + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
