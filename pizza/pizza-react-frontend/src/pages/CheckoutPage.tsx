import { useEffect, useId, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ApiError, api } from '../lib/api';
import { stripePromise } from '../lib/stripe';
import { formatMoney, lineTotal } from '../lib/money';
import { StripePaymentForm } from '../components/StripePaymentForm';
import { profileApi } from '../lib/profileApi';
import type { Address, OrderCreateRequest, OrderCreateResponse } from '../types';

/**
 * Checkout, in two steps.
 *
 * <p>1. Collect contact/address and POST /api/orders. The server prices the cart from the database,
 * saves the order as PENDING_PAYMENT and opens a Stripe PaymentIntent, returning its clientSecret.
 *
 * <p>2. Render Stripe Elements against that clientSecret and confirm the card.
 *
 * <p>The order has to exist before the payment form can render, because the PaymentIntent is what
 * the card form is confirming. That ordering is why this is two steps rather than one big submit.
 *
 * <p>Note what is NOT sent in step 1: no prices. The server decides what the cart costs.
 */
export function CheckoutPage() {
  const { items, totals, orderType, setOrderType, clear } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const formId = useId();
  const [validated, setValidated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set once the order exists server-side; its presence is what advances us to step 2.
  const [created, setCreated] = useState<OrderCreateResponse | null>(null);

  /*
   * Saved addresses, for signed-in customers.
   *
   * `NEW` is a sentinel meaning "type a fresh address instead of using a saved one". Modelling it
   * as one selection value rather than a separate boolean keeps the radio group honest: exactly
   * one option is selected at any time.
   */
  const NEW_ADDRESS = 'NEW';
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(NEW_ADDRESS);

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
  // Only ask for typed address fields when there is no saved address selected.
  const usingNewAddress = selectedAddressId === NEW_ADDRESS;

  /*
   * Load the customer's saved addresses and preselect their PRIMARY one.
   *
   * Guests skip this entirely — they have no account, so there is nothing to load.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    profileApi
      .listAddresses()
      .then((saved) => {
        if (cancelled) return;
        setAddresses(saved);

        const primary = saved.find((a) => a.primary) ?? saved[0];
        if (primary) {
          setSelectedAddressId(primary.id);
          setForm((current) => ({
            ...current,
            phone: current.phone || (primary.phone ?? ''),
          }));
        }
      })
      .catch(() => {
        // A profile that will not load must not block checkout — fall back to typing an address.
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  function updateField(field: keyof typeof form, value: string) {
    // Functional update: safe even if several updates are batched together.
    setForm((current) => ({ ...current, [field]: value }));
  }

  /** The address fields to send: from the chosen saved address, or from the form. */
  function addressFields() {
    if (!usingNewAddress) {
      const chosen = addresses.find((a) => a.id === selectedAddressId);
      if (chosen) {
        return {
          addressLine1: chosen.line1,
          addressLine2: chosen.line2 ?? undefined,
          city: chosen.city,
          state: chosen.state,
          postalCode: chosen.postalCode,
        };
      }
    }
    return {
      addressLine1: form.addressLine1,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
    };
  }

  async function handleCreateOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    // Bootstrap's validation styling is driven by the browser's own constraint validation API.
    if (!formElement.checkValidity()) {
      event.stopPropagation();
      setValidated(true);
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: OrderCreateRequest = {
      orderType,
      customerName: form.customerName,
      // Ignored by the server when a token is present — the account's email wins.
      guestEmail: form.email,
      phone: form.phone || undefined,
      // A saved address wins when one is selected; otherwise use what was typed.
      ...(isDelivery ? addressFields() : {}),
      items: items.map((item) => ({
        productId: item.productId,
        size: item.size,
        crustId: item.crustId,
        toppingIds: item.toppings.map((t) => t.id),
        quantity: item.quantity,
      })),
    };

    try {
      const response = await api.post<OrderCreateResponse>('/api/orders', payload, {
        auth: isAuthenticated,
      });
      setCreated(response);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Is the API running on port 8085?',
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Stripe accepted the card. The cart is done; the confirmation page confirms with the server. */
  function handlePaymentSuccess() {
    const orderId = created!.order.id;
    clear();
    navigate(`/order-confirmation/${orderId}`);
  }

  if (items.length === 0 && !created) {
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

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      <Row className="g-4">
        <Col lg={7}>
          {created ? (
            /* ---------------------------------------------- step 2: pay */
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h2 className="h6 fw-bold text-uppercase text-muted mb-3">Payment</h2>

                {created.clientSecret ? (
                  /*
                   * `key` on Elements matters: the provider reads clientSecret once, at mount.
                   * Keying it to the secret guarantees a fresh Elements instance if the customer
                   * ever goes back and creates a different order.
                   */
                  <Elements
                    key={created.clientSecret}
                    stripe={stripePromise}
                    options={{
                      clientSecret: created.clientSecret,
                      appearance: { theme: 'stripe', variables: { colorPrimary: '#d8102a' } },
                    }}
                  >
                    <StripePaymentForm
                      total={created.order.total}
                      onSuccess={handlePaymentSuccess}
                    />
                  </Elements>
                ) : (
                  <Alert variant="warning" className="mb-0">
                    The server created order <strong>{created.order.id}</strong> but returned no
                    Stripe client secret, which means no Stripe key is configured on the backend.
                    Set <code>pizza.stripe.secret-key</code> in{' '}
                    <code>application-local.properties</code> and run with the{' '}
                    <code>local</code> profile.
                  </Alert>
                )}
              </Card.Body>
            </Card>
          ) : (
            /* ---------------------------------------------- step 1: details */
            <Form noValidate validated={validated} onSubmit={handleCreateOrder} id="checkout-form">
              {!isAuthenticated && (
                <Alert variant="light" className="border">
                  Checking out as a guest.{' '}
                  <Alert.Link onClick={() => navigate('/login')} role="button">
                    Sign in
                  </Alert.Link>{' '}
                  to save this order to your account — entirely optional.
                </Alert>
              )}

              {/*
                Delivery vs pickup, chosen here as well as in the cart drawer. It changes the
                price (a delivery fee) and which fields are required, so making the customer go
                back to the drawer to change their mind is needless friction.
              */}
              <Card className="mb-4 border-0 shadow-sm">
                <Card.Body>
                  <h2 className="h6 fw-bold text-uppercase text-muted mb-3">How would you like it?</h2>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant={isDelivery ? 'primary' : 'outline-primary'}
                      aria-pressed={isDelivery}
                      onClick={() => setOrderType('DELIVERY')}
                    >
                      Delivery
                      <span className="d-block small fw-normal">
                        {formatMoney(3.99)} fee
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant={!isDelivery ? 'primary' : 'outline-primary'}
                      aria-pressed={!isDelivery}
                      onClick={() => setOrderType('CARRYOUT')}
                    >
                      Pick up
                      <span className="d-block small fw-normal">No fee</span>
                    </Button>
                  </div>
                </Card.Body>
              </Card>

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

                    {/* Saved addresses, primary preselected. Guests never see this. */}
                    {addresses.length > 0 && (
                      <div className="mb-3">
                        {addresses.map((address) => (
                          <Form.Check
                            key={address.id}
                            type="radio"
                            name="savedAddress"
                            id={`address-${address.id}`}
                            checked={selectedAddressId === address.id}
                            onChange={() => setSelectedAddressId(address.id)}
                            label={
                              <span>
                                <span className="fw-semibold">{address.label || 'Address'}</span>
                                {address.primary && (
                                  <span className="badge bg-success ms-2">primary</span>
                                )}
                                <span className="d-block text-muted small">
                                  {address.line1}, {address.city}, {address.state}{' '}
                                  {address.postalCode}
                                </span>
                              </span>
                            }
                          />
                        ))}
                        <Form.Check
                          type="radio"
                          name="savedAddress"
                          id="address-new"
                          checked={usingNewAddress}
                          onChange={() => setSelectedAddressId(NEW_ADDRESS)}
                          label="Use a different address"
                        />
                      </div>
                    )}

                    {usingNewAddress && (
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
                    )}
                  </Card.Body>
                </Card>
              )}
            </Form>
          )}
        </Col>

        <Col lg={5}>
          <Card className="border-0 shadow-sm sticky-summary">
            <Card.Body>
              <h2 className="h6 fw-bold text-uppercase text-muted mb-3">
                Order summary · {orderType.toLowerCase()}
              </h2>

              {(created ? created.order.items : items).map((item) => (
                <div
                  key={'lineId' in item ? item.lineId : item.id}
                  className="d-flex justify-content-between small mb-2"
                >
                  <span>
                    {item.quantity} × {item.productName}
                    <span className="text-muted">
                      {' '}
                      ({item.size.toLowerCase()}
                      {item.crustName ? `, ${item.crustName}` : ''})
                    </span>
                  </span>
                  <span>
                    {formatMoney('lineId' in item ? lineTotal(item) : item.lineTotal)}
                  </span>
                </div>
              ))}

              <hr />

              {/* Once the order exists, show the SERVER's figures — they are the real ones. */}
              {(() => {
                const money = created
                  ? {
                      subtotal: created.order.subtotal,
                      tax: created.order.tax,
                      deliveryFee: created.order.deliveryFee,
                      total: created.order.total,
                    }
                  : totals;
                return (
                  <>
                    <div className="d-flex justify-content-between small">
                      <span>Subtotal</span>
                      <span>{formatMoney(money.subtotal)}</span>
                    </div>
                    <div className="d-flex justify-content-between small">
                      <span>Tax</span>
                      <span>{formatMoney(money.tax)}</span>
                    </div>
                    {money.deliveryFee > 0 && (
                      <div className="d-flex justify-content-between small">
                        <span>Delivery</span>
                        <span>{formatMoney(money.deliveryFee)}</span>
                      </div>
                    )}
                    <div className="d-flex justify-content-between fw-bold fs-5 mt-2">
                      <span>Total</span>
                      <span>{formatMoney(money.total)}</span>
                    </div>
                  </>
                );
              })()}

              {!created && (
                <Button
                  type="submit"
                  form="checkout-form"
                  variant="primary"
                  size="lg"
                  className="w-100 mt-3"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" className="me-2" />
                      Creating order…
                    </>
                  ) : (
                    'Continue to payment'
                  )}
                </Button>
              )}

              {created && (
                <p className="small text-muted mt-3 mb-0">
                  Order <code>{created.order.id}</code> is reserved. It is not paid until the card
                  is confirmed.
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
