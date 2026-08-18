import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { formatMoney } from '../../lib/money';
import { useMenu } from '../../context/MenuContext';
import { useToast } from '../../context/ToastContext';
import { useAppDispatch, useAppSelector } from '../../store';
import { failureMessage, type ApiFailure } from '../../store/apiFailure';
import {
  deleteCrust,
  fetchCrusts,
  saveCrust,
  selectCatalogError,
  selectCatalogLoading,
  selectCrusts,
} from '../../store/catalogSlice';
import type { Crust, CrustWriteRequest } from '../../types';

const empty: CrustWriteRequest = { name: '', priceDelta: 0, active: true, displayOrder: 0 };

export default function AdminCrustsPage() {
  // Store for the list; useState for the modal and its form. See AdminToppingsPage for why.
  const dispatch = useAppDispatch();
  const crusts = useAppSelector(selectCrusts);
  const loading = useAppSelector(selectCatalogLoading);
  const error = useAppSelector(selectCatalogError);

  const [editing, setEditing] = useState<Crust | 'new' | null>(null);
  const [form, setForm] = useState<CrustWriteRequest>(empty);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { showToast } = useToast();
  const { reload: reloadMenu } = useMenu();

  useEffect(() => {
    void dispatch(fetchCrusts());
  }, [dispatch]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const id = editing === 'new' ? undefined : editing?.id;
      await dispatch(saveCrust({ id, body: form })).unwrap();
      showToast(`${form.name} ${id ? 'updated' : 'created'}`);
      setEditing(null);
      reloadMenu();
    } catch (err) {
      setFieldErrors((err as ApiFailure)?.fieldErrors ?? {});
      setFormError(failureMessage(err, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading && crusts.length === 0) {
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
                        try {
                          await dispatch(deleteCrust(crust.id)).unwrap();
                          showToast(`${crust.name} deleted`, 'danger');
                          reloadMenu();
                        } catch (err) {
                          showToast(failureMessage(err, 'Could not delete that crust'), 'danger');
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
