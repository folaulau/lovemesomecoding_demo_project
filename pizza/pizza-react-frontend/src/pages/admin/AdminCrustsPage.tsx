import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { adminApi } from '../../lib/adminApi';
import { formatMoney } from '../../lib/money';
import { useMenu } from '../../context/MenuContext';
import { useToast } from '../../context/ToastContext';
import type { Crust, CrustWriteRequest } from '../../types';

const empty: CrustWriteRequest = { name: '', priceDelta: 0, active: true, displayOrder: 0 };

export default function AdminCrustsPage() {
  const [crusts, setCrusts] = useState<Crust[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Crust | 'new' | null>(null);
  const [form, setForm] = useState<CrustWriteRequest>(empty);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { showToast } = useToast();
  const { reload: reloadMenu } = useMenu();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCrusts(await adminApi.listCrusts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load crusts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      if (editing === 'new') {
        await adminApi.createCrust(form);
        showToast(`${form.name} created`);
      } else if (editing) {
        await adminApi.updateCrust(editing.id, form);
        showToast(`${form.name} updated`);
      }
      setEditing(null);
      await load();
      reloadMenu();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors());
        setFormError(err.message);
      } else {
        setFormError('Could not save.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" role="status">
          <span className="visually-hidden">Loading crusts…</span>
        </Spinner>
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 fw-bold mb-0">Crusts · {crusts.length}</h2>
        <Button
          variant="primary"
          onClick={() => {
            setForm(empty);
            setFieldErrors({});
            setFormError(null);
            setEditing('new');
          }}
        >
          Add crust
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th className="ps-3">Name</th>
                <th>Surcharge</th>
                <th>Order</th>
                <th>Status</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {crusts.map((crust) => (
                <tr key={crust.id}>
                  <td className="ps-3 fw-semibold">{crust.name}</td>
                  <td>{crust.priceDelta > 0 ? `+${formatMoney(crust.priceDelta)}` : '—'}</td>
                  <td className="small text-muted">{crust.displayOrder}</td>
                  <td>
                    {crust.active ? (
                      <Badge bg="success">active</Badge>
                    ) : (
                      <Badge bg="warning" text="dark">
                        hidden
                      </Badge>
                    )}
                  </td>
                  <td className="text-end pe-3">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => {
                        setForm({
                          name: crust.name,
                          priceDelta: crust.priceDelta,
                          active: crust.active,
                          displayOrder: crust.displayOrder,
                        });
                        setFieldErrors({});
                        setFormError(null);
                        setEditing(crust);
                      }}
                    >
                      Edit
                    </Button>{' '}
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={async () => {
                        await adminApi.deleteCrust(crust.id);
                        showToast(`${crust.name} deleted`, 'danger');
                        await load();
                        reloadMenu();
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={editing !== null} onHide={() => setEditing(null)} centered>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">
              {editing === 'new' ? 'New crust' : `Edit ${form.name}`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label htmlFor="crust-name">Name</Form.Label>
                <Form.Control
                  id="crust-name"
                  required
                  value={form.name}
                  isInvalid={Boolean(fieldErrors.name)}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.name}</Form.Control.Feedback>
              </Col>
              <Col md={6}>
                <Form.Label htmlFor="crust-delta">Surcharge</Form.Label>
                <Form.Control
                  id="crust-delta"
                  type="number"
                  min="0"
                  step="0.25"
                  required
                  value={form.priceDelta}
                  isInvalid={Boolean(fieldErrors.priceDelta)}
                  onChange={(e) => setForm({ ...form, priceDelta: Number(e.target.value) })}
                />
                <Form.Text muted>Added on top of the size price.</Form.Text>
              </Col>
              <Col md={6}>
                <Form.Label htmlFor="crust-order">Display order</Form.Label>
                <Form.Control
                  id="crust-order"
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                />
              </Col>
              <Col xs={12}>
                <Form.Check
                  id="crust-active"
                  type="switch"
                  label="Available in the builder"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save crust'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
