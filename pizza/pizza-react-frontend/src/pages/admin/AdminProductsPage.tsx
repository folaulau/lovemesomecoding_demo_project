import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { adminApi } from '../../lib/adminApi';
import { formatMoney } from '../../lib/money';
import { useMenu } from '../../context/MenuContext';
import { useToast } from '../../context/ToastContext';
import type { Product, ProductType, ProductWriteRequest, SizeName } from '../../types';

const SIZES: SizeName[] = ['SMALL', 'MEDIUM', 'LARGE'];

/** A blank form, used when creating. */
function emptyForm(): ProductWriteRequest {
  return {
    name: '',
    description: '',
    type: 'PIZZA',
    imageUrl: null,
    active: true,
    displayOrder: 0,
    sizes: SIZES.map((size) => ({ size, price: 0 })),
  };
}

/** Turn an existing product into the write shape the API expects. */
function toForm(product: Product): ProductWriteRequest {
  return {
    name: product.name,
    description: product.description ?? '',
    type: product.type,
    imageUrl: product.imageUrl,
    active: product.active,
    displayOrder: product.displayOrder,
    sizes: SIZES.map((size) => ({
      size,
      price: product.sizes.find((s) => s.size === size)?.price ?? 0,
    })),
  };
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = modal closed. An id = editing; 'new' = creating.
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<ProductWriteRequest>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { showToast } = useToast();
  // The public menu is cached in context; refresh it whenever the catalogue changes.
  const { reload: reloadMenu } = useMenu();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await adminApi.listProducts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm());
    setFieldErrors({});
    setFormError(null);
    setEditing('new');
  }

  function openEdit(product: Product) {
    setForm(toForm(product));
    setFieldErrors({});
    setFormError(null);
    setEditing(product);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setFormError(null);

    try {
      if (editing === 'new') {
        await adminApi.createProduct(form);
        showToast(`${form.name} created`);
      } else if (editing) {
        await adminApi.updateProduct(editing.id, form);
        showToast(`${form.name} updated`);
      }
      setEditing(null);
      await load();
      reloadMenu();
    } catch (err) {
      if (err instanceof ApiError) {
        // The API returns field-level failures; surface them next to the inputs rather than
        // dumping one generic message.
        setFieldErrors(err.fieldErrors());
        setFormError(err.message);
      } else {
        setFormError('Could not save. Is the API running?');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(product: Product) {
    await adminApi.deactivateProduct(product.id);
    showToast(`${product.name} hidden from the menu`, 'info');
    await load();
    reloadMenu();
  }

  async function handleDelete(product: Product) {
    await adminApi.deleteProduct(product.id);
    showToast(`${product.name} deleted`, 'danger');
    await load();
    reloadMenu();
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" role="status">
          <span className="visually-hidden">Loading products…</span>
        </Spinner>
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 fw-bold mb-0">Products · {products.length}</h2>
        <Button variant="primary" onClick={openCreate}>
          Add product
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th className="ps-3">Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Small</th>
                <th>Medium</th>
                <th>Large</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="ps-3">
                    <div className="fw-semibold">{product.name}</div>
                    <div className="text-muted small">{product.description}</div>
                  </td>
                  <td>
                    <Badge bg={product.type === 'PIZZA' ? 'primary' : 'secondary'}>
                      {product.type}
                    </Badge>
                  </td>
                  <td>
                    {product.active ? (
                      <Badge bg="success">active</Badge>
                    ) : (
                      <Badge bg="warning" text="dark">
                        hidden
                      </Badge>
                    )}
                  </td>
                  {SIZES.map((size) => (
                    <td key={size} className="small">
                      {formatMoney(product.sizes.find((s) => s.size === size)?.price ?? 0)}
                    </td>
                  ))}
                  <td className="text-end pe-3">
                    <Button size="sm" variant="outline-secondary" onClick={() => openEdit(product)}>
                      Edit
                    </Button>{' '}
                    {product.active && (
                      <Button
                        size="sm"
                        variant="outline-warning"
                        onClick={() => void handleDeactivate(product)}
                      >
                        Hide
                      </Button>
                    )}{' '}
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => void handleDelete(product)}
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

      <Modal show={editing !== null} onHide={() => setEditing(null)} size="lg" centered>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">
              {editing === 'new' ? 'New product' : `Edit ${form.name}`}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}

            <Row className="g-3">
              <Col md={8}>
                <Form.Label htmlFor="product-name">Name</Form.Label>
                <Form.Control
                  id="product-name"
                  required
                  value={form.name}
                  isInvalid={Boolean(fieldErrors.name)}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.name}</Form.Control.Feedback>
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="product-type">Type</Form.Label>
                <Form.Select
                  id="product-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ProductType })}
                >
                  <option value="PIZZA">Pizza</option>
                  <option value="DRINK">Drink</option>
                </Form.Select>
              </Col>
              <Col xs={12}>
                <Form.Label htmlFor="product-description">Description</Form.Label>
                <Form.Control
                  id="product-description"
                  as="textarea"
                  rows={2}
                  value={form.description}
                  isInvalid={Boolean(fieldErrors.description)}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Col>

              <Col xs={12}>
                <div className="fw-semibold small text-uppercase text-muted mb-2">
                  Prices per size
                </div>
                <Row className="g-2">
                  {form.sizes.map((size, index) => (
                    <Col key={size.size} md={4}>
                      <Form.Label htmlFor={`price-${size.size}`} className="small">
                        {size.size.charAt(0) + size.size.slice(1).toLowerCase()}
                      </Form.Label>
                      <Form.Control
                        id={`price-${size.size}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={size.price}
                        onChange={(e) => {
                          const next = [...form.sizes];
                          next[index] = { ...size, price: Number(e.target.value) };
                          setForm({ ...form, sizes: next });
                        }}
                      />
                    </Col>
                  ))}
                </Row>
                {fieldErrors.sizes && (
                  <div className="text-danger small mt-1">{fieldErrors.sizes}</div>
                )}
              </Col>

              <Col md={6}>
                <Form.Label htmlFor="product-order">Display order</Form.Label>
                <Form.Control
                  id="product-order"
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                />
              </Col>
              <Col md={6} className="d-flex align-items-end">
                <Form.Check
                  id="product-active"
                  type="switch"
                  label="Visible on the menu"
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
              {saving ? 'Saving…' : 'Save product'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
