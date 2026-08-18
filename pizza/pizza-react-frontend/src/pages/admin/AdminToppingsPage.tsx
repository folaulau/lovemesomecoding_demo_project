import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { formatMoney } from '../../lib/money';
import { useMenu } from '../../context/MenuContext';
import { useToast } from '../../context/ToastContext';
import { useAppDispatch, useAppSelector } from '../../store';
import { failureMessage, type ApiFailure } from '../../store/apiFailure';
import {
  deleteTopping,
  fetchToppings,
  saveTopping,
  selectCatalogError,
  selectCatalogLoading,
  selectToppings,
} from '../../store/catalogSlice';
import type { Topping, ToppingCategory, ToppingWriteRequest } from '../../types';

const CATEGORIES: ToppingCategory[] = ['MEAT', 'VEGGIE', 'CHEESE'];

const empty: ToppingWriteRequest = { name: '', price: 1, category: 'MEAT', active: true };

export default function AdminToppingsPage() {
  /*
   * The topping LIST is store state — shared, refetched, mutated from two places.
   *
   * Everything below it (which row is open, what is typed into the form, which field is invalid)
   * stays in useState on purpose. It is scratch state belonging to one component, it dies with the
   * modal, and no other screen can meaningfully read it. Putting form keystrokes in a global store
   * is the classic way to make Redux miserable — the rule is "shared state goes in the store", not
   * "all state goes in the store".
   */
  const dispatch = useAppDispatch();
  const toppings = useAppSelector(selectToppings);
  const loading = useAppSelector(selectCatalogLoading);
  const error = useAppSelector(selectCatalogError);

  const [editing, setEditing] = useState<Topping | 'new' | null>(null);
  const [form, setForm] = useState<ToppingWriteRequest>(empty);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { showToast } = useToast();
  const { reload: reloadMenu } = useMenu();

  useEffect(() => {
    void dispatch(fetchToppings());
  }, [dispatch]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const id = editing === 'new' ? undefined : editing?.id;
      await dispatch(saveTopping({ id, body: form })).unwrap();
      showToast(`${form.name} ${id ? 'updated' : 'created'}`);
      setEditing(null);
      // The public menu is Context, not Redux, so it has to be told the catalogue moved.
      reloadMenu();
    } catch (err) {
      // unwrap() re-throws the ApiFailure the thunk rejected with — the field errors survived the
      // trip through Redux precisely because they were flattened into a plain object first.
      setFieldErrors((err as ApiFailure)?.fieldErrors ?? {});
      setFormError(failureMessage(err, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading && toppings.length === 0) {
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
                        try {
                          await dispatch(deleteTopping(topping.id)).unwrap();
                          showToast(`${topping.name} deleted`, 'danger');
                          reloadMenu();
                        } catch (err) {
                          showToast(failureMessage(err, 'Could not delete that topping'), 'danger');
                        }
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
