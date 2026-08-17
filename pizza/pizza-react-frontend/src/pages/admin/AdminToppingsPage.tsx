import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { adminApi } from '../../lib/adminApi';
import { formatMoney } from '../../lib/money';
import { useMenu } from '../../context/MenuContext';
import { useToast } from '../../context/ToastContext';
import type { Topping, ToppingCategory, ToppingWriteRequest } from '../../types';

const CATEGORIES: ToppingCategory[] = ['MEAT', 'VEGGIE', 'CHEESE'];

const empty: ToppingWriteRequest = { name: '', price: 1, category: 'MEAT', active: true };

export default function AdminToppingsPage() {
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Topping | 'new' | null>(null);
  const [form, setForm] = useState<ToppingWriteRequest>(empty);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { showToast } = useToast();
  const { reload: reloadMenu } = useMenu();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setToppings(await adminApi.listToppings());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load toppings.');
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
        await adminApi.createTopping(form);
        showToast(`${form.name} created`);
      } else if (editing) {
        await adminApi.updateTopping(editing.id, form);
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
          <span className="visually-hidden">Loading toppings…</span>
        </Spinner>
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 fw-bold mb-0">Toppings · {toppings.length}</h2>
        <Button
          variant="primary"
          onClick={() => {
            setForm(empty);
            setFieldErrors({});
            setFormError(null);
            setEditing('new');
          }}
        >
          Add topping
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th className="ps-3">Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {toppings.map((topping) => (
                <tr key={topping.id}>
                  <td className="ps-3 fw-semibold">{topping.name}</td>
                  <td className="small text-muted">{topping.category.toLowerCase()}</td>
                  <td>{formatMoney(topping.price)}</td>
                  <td>
                    {topping.active ? (
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
                          name: topping.name,
                          price: topping.price,
                          category: topping.category,
                          active: topping.active,
                        });
                        setFieldErrors({});
                        setFormError(null);
                        setEditing(topping);
                      }}
                    >
                      Edit
                    </Button>{' '}
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={async () => {
                        await adminApi.deleteTopping(topping.id);
                        showToast(`${topping.name} deleted`, 'danger');
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
              {editing === 'new' ? 'New topping' : `Edit ${form.name}`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label htmlFor="topping-name">Name</Form.Label>
                <Form.Control
                  id="topping-name"
                  required
                  value={form.name}
                  isInvalid={Boolean(fieldErrors.name)}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.name}</Form.Control.Feedback>
              </Col>
              <Col md={6}>
                <Form.Label htmlFor="topping-price">Price</Form.Label>
                <Form.Control
                  id="topping-price"
                  type="number"
                  min="0"
                  step="0.25"
                  required
                  value={form.price}
                  isInvalid={Boolean(fieldErrors.price)}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.price}</Form.Control.Feedback>
              </Col>
              <Col md={6}>
                <Form.Label htmlFor="topping-category">Category</Form.Label>
                <Form.Select
                  id="topping-category"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as ToppingCategory })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={12}>
                <Form.Check
                  id="topping-active"
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
              {saving ? 'Saving…' : 'Save topping'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
