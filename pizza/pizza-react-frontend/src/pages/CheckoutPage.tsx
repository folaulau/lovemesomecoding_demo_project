import { useId, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatMoney, lineTotal } from '../lib/money';

/**
 * Checkout.
 *
 * Phase 2 stops at "Place order" — there is no Stripe here yet. Phase 4 replaces the submit
 * handler with a POST to /api/orders followed by Stripe Elements confirmation.
 *
 * The important product decision on this page: signing in is optional. A guest supplies an email
 * and nothing more, which is the whole point of guest checkout.
 */
export function CheckoutPage() {
  const { items, totals, orderType, clear } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // useId keeps label/input pairs correctly associated without hardcoding ids.
  const formId = useId();
  const [validated, setValidated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customerName: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const isDelivery = orderType === 'DELIVERY';

  function updateField(field: keyof typeof form, value: string) {
    // Functional update: safe even if several updates are batched together.
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    // Bootstrap's validation styling is driven by the browser's own constraint validation API.
    if (!formElement.checkValidity()) {
      event.stopPropagation();
      setValidated(true);
      return;
    }

    setSubmitting(true);
    // Phase 4: POST /api/orders, then confirm the PaymentIntent with Stripe Elements.
    await new Promise((resolve) => setTimeout(resolve, 600));

    const mockOrderId = Math.floor(Math.random() * 9000) + 1000;
    clear();
    setSubmitting(false);
    navigate(`/order-confirmation/${mockOrderId}`);
  }

  if (items.length === 0) {
    return (
      <Container className="py-5">
        <Alert variant="light" className="text-center border">
          <h1 className="h5">Your cart is empty</h1>
          <p className="text-muted">Add a pizza before checking out.</p>
          <Button variant="primary" onClick={() => navigate('/menu')}>
            Browse the menu
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-4">Checkout</h1>

      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Row className="g-4">
          <Col lg={7}>
            {!isAuthenticated && (
              <Alert variant="light" className="border">
                Checking out as a guest.{' '}
                <Alert.Link onClick={() => navigate('/login')} role="button">
                  Sign in
                </Alert.Link>{' '}
                to save this order to your account — entirely optional.
              </Alert>
            )}

            <Card className="mb-4 border-0 shadow-sm">
              <Card.Body>
                <h2 className="h6 fw-bold text-uppercase text-muted mb-3">Contact</h2>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label htmlFor={`${formId}-name`}>Name</Form.Label>
                    <Form.Control
                      id={`${formId}-name`}
                      required
                      value={form.customerName}
                      onChange={(e) => updateField('customerName', e.target.value)}
                      autoComplete="name"
                    />
                    <Form.Control.Feedback type="invalid">
                      Please tell us who the order is for.
                    </Form.Control.Feedback>
                  </Col>
                  <Col md={6}>
                    <Form.Label htmlFor={`${formId}-email`}>Email</Form.Label>
                    <Form.Control
                      id={`${formId}-email`}
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      autoComplete="email"
                    />
                    <Form.Control.Feedback type="invalid">
                      We need a valid email to send the receipt.
                    </Form.Control.Feedback>
                  </Col>
                  <Col md={6}>
                    <Form.Label htmlFor={`${formId}-phone`}>Phone</Form.Label>
                    <Form.Control
                      id={`${formId}-phone`}
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      autoComplete="tel"
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Address fields only exist for delivery — the toggle lives in the cart drawer. */}
            {isDelivery && (
              <Card className="mb-4 border-0 shadow-sm">
                <Card.Body>
                  <h2 className="h6 fw-bold text-uppercase text-muted mb-3">Delivery address</h2>
                  <Row className="g-3">
                    <Col xs={12}>
                      <Form.Label htmlFor={`${formId}-address`}>Street address</Form.Label>
                      <Form.Control
                        id={`${formId}-address`}
                        required
                        value={form.addressLine1}
                        onChange={(e) => updateField('addressLine1', e.target.value)}
                        autoComplete="address-line1"
                      />
                      <Form.Control.Feedback type="invalid">
                        We cannot deliver without a street address.
                      </Form.Control.Feedback>
                    </Col>
                    <Col md={5}>
                      <Form.Label htmlFor={`${formId}-city`}>City</Form.Label>
                      <Form.Control
                        id={`${formId}-city`}
                        required
                        value={form.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        autoComplete="address-level2"
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label htmlFor={`${formId}-state`}>State</Form.Label>
                      <Form.Control
                        id={`${formId}-state`}
                        required
                        value={form.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        autoComplete="address-level1"
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Label htmlFor={`${formId}-zip`}>ZIP</Form.Label>
                      <Form.Control
                        id={`${formId}-zip`}
                        required
                        pattern="[0-9]{5}"
                        value={form.postalCode}
                        onChange={(e) => updateField('postalCode', e.target.value)}
                        autoComplete="postal-code"
                      />
                      <Form.Control.Feedback type="invalid">
                        Five digits, please.
                      </Form.Control.Feedback>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}

            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h2 className="h6 fw-bold text-uppercase text-muted mb-3">Payment</h2>
                <Alert variant="warning" className="mb-0">
                  Stripe card entry is wired up in Phase 4. For now, placing the order simply
                  jumps to the confirmation page.
                </Alert>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={5}>
            <Card className="border-0 shadow-sm sticky-summary">
              <Card.Body>
                <h2 className="h6 fw-bold text-uppercase text-muted mb-3">
                  Order summary · {orderType.toLowerCase()}
                </h2>

                {items.map((item) => (
                  <div key={item.lineId} className="d-flex justify-content-between small mb-2">
                    <span>
                      {item.quantity} × {item.productName}
                      <span className="text-muted">
                        {' '}
                        ({item.size.toLowerCase()}
                        {item.crustName ? `, ${item.crustName}` : ''})
                      </span>
                    </span>
                    <span>{formatMoney(lineTotal(item))}</span>
                  </div>
                ))}

                <hr />

                <div className="d-flex justify-content-between small">
                  <span>Subtotal</span>
                  <span>{formatMoney(totals.subtotal)}</span>
                </div>
                <div className="d-flex justify-content-between small">
                  <span>Tax</span>
                  <span>{formatMoney(totals.tax)}</span>
                </div>
                {totals.deliveryFee > 0 && (
                  <div className="d-flex justify-content-between small">
                    <span>Delivery</span>
                    <span>{formatMoney(totals.deliveryFee)}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between fw-bold fs-5 mt-2">
                  <span>Total</span>
                  <span>{formatMoney(totals.total)}</span>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-100 mt-3"
                  disabled={submitting}
                >
                  {submitting ? 'Placing order…' : `Place order · ${formatMoney(totals.total)}`}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Form>
    </Container>
  );
}
