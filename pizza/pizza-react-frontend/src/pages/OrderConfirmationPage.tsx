import { Card, Container } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';

export function OrderConfirmationPage() {
  // useParams reads the :orderId segment declared in the route path.
  const { orderId } = useParams<{ orderId: string }>();

  return (
    <Container className="py-5">
      <Card className="border-0 shadow-sm mx-auto" style={{ maxWidth: '32rem' }}>
        <Card.Body className="text-center p-4">
          <div className="display-4 mb-2" aria-hidden="true">
            🍕
          </div>
          <h1 className="h4 fw-bold">Order confirmed</h1>
          <p className="text-muted">
            Order <strong>#{orderId}</strong> is in the oven. Estimated 25–35 minutes.
          </p>
          <p className="small text-muted">
            In Phase 4 this page polls the API for the real order status, because Stripe webhooks
            do not reach localhost unless <code>stripe listen</code> is running.
          </p>
          <Link to="/menu" className="btn btn-primary">
            Order something else
          </Link>
        </Card.Body>
      </Card>
    </Container>
  );
}
