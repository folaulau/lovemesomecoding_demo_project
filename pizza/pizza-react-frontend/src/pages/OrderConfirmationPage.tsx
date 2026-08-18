import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Card, Col, Container, ListGroup, Row, Spinner } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatMoney } from '../lib/money';
import type { Order, OrderStatus } from '../types';

const STATUS_VARIANT: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'primary',
  PREPARING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'secondary',
};

/** How long to keep asking before giving up and telling the customer to check their email. */
const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;

export function OrderConfirmationPage() {
  // useParams reads the :orderId segment declared in the route path. It is a UUID.
  const { orderId } = useParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  // A ref, not state: bumping the count must not trigger a re-render.
  const pollCount = useRef(0);

  /*
   * Poll /payment-status until the order leaves PENDING_PAYMENT.
   *
   * Why poll at all, when there is a webhook? Because a webhook does not reach localhost unless
   * `stripe listen` is running, and even in production it can arrive seconds later than the
   * customer. That endpoint asks Stripe directly, so the page is correct either way.
   *
   * The browser is never the authority here: it only asks the server what the server believes.
   */
  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const fresh = await api.get<Order>(`/api/orders/${orderId}/payment-status`);
        if (cancelled) return;

        setOrder(fresh);
        setError(null);

        if (fresh.status !== 'PENDING_PAYMENT') {
          setSettled(true);
          return;
        }

        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          setSettled(true);
          return;
        }
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the order.');
        setSettled(true);
      }
    }

    void poll();

    // Cleanup stops the loop when the user navigates away — otherwise it would keep firing
    // requests against an unmounted component forever.
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId]);

  return (
    <Container className="py-5">
      <Card className="border-0 shadow-sm mx-auto" style={{ maxWidth: '38rem' }}>
        <Card.Body className="p-4">
          <div className="text-center">
            <div className="display-4 mb-2" aria-hidden="true">
              🍕
            </div>
            <h1 className="h4 fw-bold">
              {order?.status === 'PENDING_PAYMENT' ? 'Confirming your payment…' : 'Order confirmed'}
            </h1>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          {!order && !error && (
            <div className="text-center py-4">
              <Spinner animation="border" variant="danger" role="status">
                <span className="visually-hidden">Loading your order…</span>
              </Spinner>
            </div>
          )}

          {order && (
            <>
              <p className="text-muted text-center">
                Order <strong>{order.id}</strong>
                <br />
                <Badge bg={STATUS_VARIANT[order.status]} className="mt-2">
                  {order.status.replace('_', ' ')}
                </Badge>
              </p>

              {order.status === 'PENDING_PAYMENT' && !settled && (
                <Alert variant="light" className="border d-flex align-items-center gap-2">
                  <Spinner animation="border" size="sm" />
                  <span className="small">
                    Waiting for the payment to settle. This page checks with Stripe every couple of
                    seconds.
                  </span>
                </Alert>
              )}

              {order.status === 'PENDING_PAYMENT' && settled && (
                <Alert variant="warning" className="small">
                  Still pending. If you completed the card form, the confirmation may just be
                  delayed — run <code>stripe listen --forward-to localhost:8085/api/webhooks/stripe</code>{' '}
                  locally, or refresh this page in a moment.
                </Alert>
              )}

              {/*
                Where it is going, and what paid for it. Both come from the order the SERVER
                returns — the browser is not remembering anything from checkout.
              */}
              <Row className="g-3 mb-3">
                {order.orderType === 'DELIVERY' && order.addressLine1 && (
                  <Col sm={6}>
                    <div className="text-muted small text-uppercase">Delivering to</div>
                    <div className="small">
                      {order.customerName}
                      <br />
                      {order.addressLine1}
                      {order.addressLine2 && (
                        <>
                          <br />
                          {order.addressLine2}
                        </>
                      )}
                      <br />
                      {order.city}, {order.state} {order.postalCode}
                      {order.phone && (
                        <>
                          <br />
                          {order.phone}
                        </>
                      )}
                    </div>
                  </Col>
                )}

                {order.orderType === 'CARRYOUT' && (
                  <Col sm={6}>
                    <div className="text-muted small text-uppercase">Collection</div>
                    <div className="small">
                      Carryout — {order.customerName}
                      {order.phone && (
                        <>
                          <br />
                          {order.phone}
                        </>
                      )}
                    </div>
                  </Col>
                )}

                <Col sm={6}>
                  <div className="text-muted small text-uppercase">Paid with</div>
                  <div className="small">
                    {order.cardLast4 ? (
                      <>
                        <span className="text-capitalize">{order.cardBrand ?? 'Card'}</span> ending{' '}
                        <strong>{order.cardLast4}</strong>
                      </>
                    ) : order.cardBrand ? (
                      /*
                       * A wallet — Link, Cash App Pay, Klarna. Stripe exposes no card brand or
                       * last4 for these, so naming the method is the honest thing to show.
                       */
                      <span className="text-capitalize">{order.cardBrand}</span>
                    ) : order.status === 'PENDING_PAYMENT' ? (
                      'Awaiting payment'
                    ) : (
                      // Seeded demo orders have no real Stripe payment behind them.
                      <span className="text-muted">Not recorded</span>
                    )}
                  </div>
                </Col>
              </Row>

              <ListGroup variant="flush" className="mb-3">
                {order.items.map((item) => (
                  <ListGroup.Item key={item.id} className="px-0">
                    <div className="d-flex justify-content-between">
                      <span>
                        {item.quantity} × {item.productName}
                        <span className="text-muted small">
                          {' '}
                          ({item.size.toLowerCase()}
                          {item.crustName ? `, ${item.crustName}` : ''})
                        </span>
                      </span>
                      <span>{formatMoney(item.lineTotal)}</span>
                    </div>
                    {item.toppings.length > 0 && (
                      <div className="small text-muted">
                        {item.toppings.map((t) => t.toppingName).join(', ')}
                      </div>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>

              <div className="d-flex justify-content-between small">
                <span>Subtotal</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              <div className="d-flex justify-content-between small">
                <span>Tax</span>
                <span>{formatMoney(order.tax)}</span>
              </div>
              {order.deliveryFee > 0 && (
                <div className="d-flex justify-content-between small">
                  <span>Delivery</span>
                  <span>{formatMoney(order.deliveryFee)}</span>
                </div>
              )}
              <div className="d-flex justify-content-between fw-bold fs-5 mt-2 mb-3">
                <span>Total</span>
                <span>{formatMoney(order.total)}</span>
              </div>

              <div className="text-center">
                <Link to="/menu" className="btn btn-primary">
                  Order something else
                </Link>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
