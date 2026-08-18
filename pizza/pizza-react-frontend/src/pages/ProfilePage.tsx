import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  ListGroup,
  Modal,
  Row,
  Spinner,
} from 'react-bootstrap';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../lib/api';
import { profileApi } from '../lib/profileApi';
import { stripePromise } from '../lib/stripe';
import type { Address, AddressWriteRequest, PaymentMethod } from '../types';

const emptyAddress: AddressWriteRequest = {
  label: '',
  recipientName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
};

/**
 * The card-collection form, rendered inside an <Elements> provider.
 *
 * Uses a SetupIntent, not a PaymentIntent: the point is to STORE a card, not charge it. The card
 * itself is typed into Stripe's iframe and goes straight to Stripe — our code only ever sees the
 * resulting `pm_…` token.
 */
function AddCardForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSaving(true);
    setError(null);

    const result = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/profile` },
    });

    if (result.error) {
      setError(result.error.message ?? 'That card could not be saved.');
      setSaving(false);
      return;
    }

    const paymentMethodId = result.setupIntent?.payment_method;
    if (typeof paymentMethodId !== 'string') {
      setError('Stripe did not return a payment method.');
      setSaving(false);
      return;
    }

    try {
      // Only the token crosses our API.
      await profileApi.addPaymentMethod(paymentMethodId);
      showToast('Card saved');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that card.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <Alert variant="danger" className="mt-3 mb-0">
          {error}
        </Alert>
      )}
      <div className="d-flex gap-2 mt-3">
        <Button type="submit" variant="primary" disabled={!stripe || saving}>
          {saving ? 'Saving…' : 'Save card'}
        </Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
      <p className="small text-muted mt-2 mb-0">
        Test mode — <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
      </p>
    </form>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Address modal
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [form, setForm] = useState<AddressWriteRequest>(emptyAddress);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Card collection
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [addressList, methodList] = await Promise.all([
        profileApi.listAddresses(),
        profileApi.listPaymentMethods(),
      ]);
      setAddresses(addressList);
      setMethods(methodList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveAddress(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      if (editing === 'new') {
        await profileApi.addAddress(form);
        showToast('Address saved');
      } else if (editing) {
        await profileApi.updateAddress(editing.id, form);
        showToast('Address updated');
      }
      setEditing(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors());
        setFormError(err.message);
      } else {
        setFormError('Could not save that address.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function startAddingCard() {
    setCardError(null);
    try {
      const { clientSecret } = await profileApi.createSetupIntent();
      setSetupSecret(clientSecret);
    } catch (err) {
      setCardError(err instanceof ApiError ? err.message : 'Could not start card setup.');
    }
  }

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="danger" role="status">
          <span className="visually-hidden">Loading your profile…</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-1">Profile</h1>
      <p className="text-muted">{user?.email}</p>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-4">
        {/* ------------------------------------------------------- account */}
        <Col lg={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <h2 className="h6 fw-bold text-uppercase text-muted mb-3">Account</h2>
              <dl className="mb-0 small">
                <dt className="text-muted fw-normal">Name</dt>
                <dd className="fw-semibold">{user?.fullName ?? '—'}</dd>
                <dt className="text-muted fw-normal">Email</dt>
                <dd className="fw-semibold">{user?.email}</dd>
                <dt className="text-muted fw-normal">Role</dt>
                <dd className="mb-0">
                  <Badge bg={user?.role === 'ADMIN' ? 'primary' : 'secondary'}>{user?.role}</Badge>
                </dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        {/* ----------------------------------------------------- addresses */}
        <Col lg={8}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h6 fw-bold text-uppercase text-muted mb-0">
                  Delivery addresses
                </h2>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setForm(emptyAddress);
                    setFieldErrors({});
                    setFormError(null);
                    setEditing('new');
                  }}
                >
                  Add address
                </Button>
              </div>

              {addresses.length === 0 ? (
                <p className="text-muted small mb-0">
                  No saved addresses yet. Add one and it will be offered at checkout.
                </p>
              ) : (
                <ListGroup variant="flush">
                  {addresses.map((address) => (
                    <ListGroup.Item key={address.id} className="px-0">
                      <div className="d-flex justify-content-between align-items-start gap-3">
                        <div>
                          <div className="fw-semibold">
                            {address.label || 'Address'}{' '}
                            {address.primary && <Badge bg="success">primary</Badge>}
                          </div>
                          <div className="small text-muted">
                            {address.line1}
                            {address.line2 ? `, ${address.line2}` : ''}, {address.city},{' '}
                            {address.state} {address.postalCode}
                          </div>
                          {address.phone && (
                            <div className="small text-muted">{address.phone}</div>
                          )}
                        </div>
                        <div className="text-nowrap">
                          {!address.primary && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={async () => {
                                await profileApi.makeAddressPrimary(address.id);
                                showToast('Primary address updated');
                                await load();
                              }}
                            >
                              Make primary
                            </Button>
                          )}{' '}
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => {
                              setForm({
                                label: address.label ?? '',
                                recipientName: address.recipientName ?? '',
                                phone: address.phone ?? '',
                                line1: address.line1,
                                line2: address.line2 ?? '',
                                city: address.city,
                                state: address.state,
                                postalCode: address.postalCode,
                              });
                              setFieldErrors({});
                              setFormError(null);
                              setEditing(address);
                            }}
                          >
                            Edit
                          </Button>{' '}
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={async () => {
                              await profileApi.deleteAddress(address.id);
                              showToast('Address removed', 'danger');
                              await load();
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>

          {/* ------------------------------------------------ payment methods */}
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h6 fw-bold text-uppercase text-muted mb-0">Payment methods</h2>
                {!setupSecret && (
                  <Button size="sm" variant="primary" onClick={startAddingCard}>
                    Add card
                  </Button>
                )}
              </div>

              {/*
                Worth stating plainly on the page itself: we do not hold the card. Stripe does.
              */}
              <p className="small text-muted">
                Cards are stored by Stripe. We keep only the brand and last four digits so you can
                tell them apart — never the card number.
              </p>

              {cardError && <Alert variant="danger">{cardError}</Alert>}

              {setupSecret ? (
                <Elements
                  key={setupSecret}
                  stripe={stripePromise}
                  options={{
                    clientSecret: setupSecret,
                    appearance: { theme: 'stripe', variables: { colorPrimary: '#d8102a' } },
                  }}
                >
                  <AddCardForm
                    onSaved={async () => {
                      setSetupSecret(null);
                      await load();
                    }}
                    onCancel={() => setSetupSecret(null)}
                  />
                </Elements>
              ) : methods.length === 0 ? (
                <p className="text-muted small mb-0">No saved cards yet.</p>
              ) : (
                <ListGroup variant="flush">
                  {methods.map((method) => (
                    <ListGroup.Item key={method.id} className="px-0">
                      <div className="d-flex justify-content-between align-items-center gap-3">
                        <div>
                          <span className="fw-semibold text-capitalize">
                            {method.brand ?? 'Card'}
                          </span>{' '}
                          ending {method.last4 ?? '••••'}{' '}
                          {method.primary && <Badge bg="success">primary</Badge>}
                          <div className="small text-muted">
                            Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}
                          </div>
                        </div>
                        <div className="text-nowrap">
                          {!method.primary && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={async () => {
                                await profileApi.makePaymentMethodPrimary(method.id);
                                showToast('Primary card updated');
                                await load();
                              }}
                            >
                              Make primary
                            </Button>
                          )}{' '}
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={async () => {
                              await profileApi.deletePaymentMethod(method.id);
                              showToast('Card removed', 'danger');
                              await load();
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* --------------------------------------------------- address modal */}
      <Modal show={editing !== null} onHide={() => setEditing(null)} centered>
        <Form onSubmit={handleSaveAddress}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">
              {editing === 'new' ? 'New address' : 'Edit address'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Row className="g-3">
              <Col md={6}>
                <Form.Label htmlFor="addr-label">Label</Form.Label>
                <Form.Control
                  id="addr-label"
                  placeholder="Home"
                  value={form.label ?? ''}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </Col>
              <Col md={6}>
                <Form.Label htmlFor="addr-phone">Phone</Form.Label>
                <Form.Control
                  id="addr-phone"
                  value={form.phone ?? ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Col>
              <Col xs={12}>
                <Form.Label htmlFor="addr-line1">Street address</Form.Label>
                <Form.Control
                  id="addr-line1"
                  required
                  value={form.line1}
                  isInvalid={Boolean(fieldErrors.line1)}
                  onChange={(e) => setForm({ ...form, line1: e.target.value })}
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.line1}</Form.Control.Feedback>
              </Col>
              <Col md={5}>
                <Form.Label htmlFor="addr-city">City</Form.Label>
                <Form.Control
                  id="addr-city"
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Col>
              <Col md={3}>
                <Form.Label htmlFor="addr-state">State</Form.Label>
                <Form.Control
                  id="addr-state"
                  required
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="addr-zip">ZIP</Form.Label>
                <Form.Control
                  id="addr-zip"
                  required
                  pattern="[0-9]{5}"
                  value={form.postalCode}
                  isInvalid={Boolean(fieldErrors.postalCode)}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                />
                <Form.Control.Feedback type="invalid">
                  {fieldErrors.postalCode ?? 'Five digits, please.'}
                </Form.Control.Feedback>
              </Col>
              <Col xs={12}>
                <Form.Check
                  id="addr-primary"
                  type="switch"
                  label="Use this address by default at checkout"
                  checked={Boolean(form.primary)}
                  onChange={(e) => setForm({ ...form, primary: e.target.checked })}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save address'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}
