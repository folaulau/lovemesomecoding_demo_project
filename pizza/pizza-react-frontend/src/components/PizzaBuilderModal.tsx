import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Badge, Button, Col, Form, Modal, Row, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import type { Crust, Product, SizeName, Topping } from '../types';
import { formatMoney, round2 } from '../lib/money';
import { MOCK_CRUSTS, MOCK_TOPPINGS } from '../mocks/menu';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

interface Props {
  product: Product | null;
  onHide: () => void;
}

const TOPPING_GROUPS: Array<{ label: string; category: Topping['category'] }> = [
  { label: 'Meats', category: 'MEAT' },
  { label: 'Veggies', category: 'VEGGIE' },
  { label: 'Cheeses', category: 'CHEESE' },
];

/**
 * The pizza builder: pick a size, a crust and toppings, and watch the price update live.
 *
 * Drinks reuse this same modal but only get the size step — one component rather than two
 * near-identical ones.
 */
export function PizzaBuilderModal({ product, onHide }: Props) {
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [size, setSize] = useState<SizeName>('MEDIUM');
  const [crustId, setCrustId] = useState<number>(MOCK_CRUSTS[0].id);
  const [selectedToppingIds, setSelectedToppingIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);

  const isPizza = product?.type === 'PIZZA';

  /*
   * REACT CONCEPT: useId
   *
   * Generates a stable, unique, SSR-safe id. Needed to tie <Form.Label htmlFor> to its input:
   * hardcoding id="quantity" would break the moment two of these render on one page, and
   * Math.random() would produce a different id on server and client.
   */
  const quantityId = useId();

  /*
   * REACT CONCEPT: useRef for DOM access
   *
   * A ref holds a mutable value that survives re-renders WITHOUT causing one when it changes.
   * Here it points at the confirm button so focus can be moved there when the modal opens —
   * important for keyboard and screen-reader users, who would otherwise be left at the top of
   * the document with no idea a dialog appeared.
   *
   * In React 19 a ref can be passed straight to a component as a normal prop; the forwardRef
   * wrapper that older tutorials use is no longer required.
   */
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Reset the form whenever a different product is opened, otherwise the previous pizza's
  // toppings would carry over to the next one.
  useEffect(() => {
    if (product) {
      setSize('MEDIUM');
      setCrustId(MOCK_CRUSTS[0].id);
      setSelectedToppingIds([]);
      setQuantity(1);
    }
  }, [product]);

  const crust: Crust | null = useMemo(
    () => (isPizza ? (MOCK_CRUSTS.find((c) => c.id === crustId) ?? null) : null),
    [isPizza, crustId],
  );

  const selectedToppings = useMemo(
    () => (isPizza ? MOCK_TOPPINGS.filter((t) => selectedToppingIds.includes(t.id)) : []),
    [isPizza, selectedToppingIds],
  );

  /*
   * REACT CONCEPT: useMemo for derived values
   *
   * The live price is recomputed only when something it depends on actually changes, rather than
   * on every keystroke elsewhere in the modal. This particular sum is cheap; the pattern matters
   * once the calculation is not.
   */
  const pricing = useMemo(() => {
    if (!product) return { unit: 0, total: 0 };

    const base = product.sizes.find((s) => s.size === size)?.price ?? 0;
    const toppingsTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
    const unit = round2(base + (crust?.priceDelta ?? 0) + toppingsTotal);

    return { unit, total: round2(unit * quantity) };
  }, [product, size, crust, selectedToppings, quantity]);

  function toggleTopping(id: number) {
    setSelectedToppingIds((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  function handleAdd() {
    if (!product) return;

    addItem({ product, size, crust, toppings: selectedToppings, quantity });
    showToast(`${quantity} × ${product.name} added to your cart`);
    onHide();
  }

  return (
    <Modal
      show={product !== null}
      onHide={onHide}
      size="lg"
      centered
      scrollable
      // Bootstrap's Modal already traps focus and restores it on close; this just picks the
      // element that should receive focus first.
      onEntered={() => confirmButtonRef.current?.focus()}
      aria-labelledby="builder-title"
    >
      <Modal.Header closeButton>
        <Modal.Title id="builder-title" className="h5">
          {product?.name}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="text-muted">{product?.description}</p>

        <section className="mb-4">
          <h4 className="h6 fw-bold text-uppercase text-muted">Size</h4>
          <ToggleButtonGroup
            type="radio"
            name="size"
            value={size}
            onChange={(value: SizeName) => setSize(value)}
            className="w-100"
          >
            {product?.sizes.map((option) => (
              <ToggleButton
                key={option.size}
                id={`size-${option.size}`}
                value={option.size}
                variant="outline-primary"
                className="size-option"
              >
                {option.size.charAt(0) + option.size.slice(1).toLowerCase()}
                <div className="small">{formatMoney(option.price)}</div>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </section>

        {/* Crust and toppings only make sense for a pizza. */}
        {isPizza && (
          <>
            <section className="mb-4">
              <h4 className="h6 fw-bold text-uppercase text-muted">Crust</h4>
              <Row xs={2} md={4} className="g-2">
                {MOCK_CRUSTS.map((option) => (
                  <Col key={option.id}>
                    <Form.Check
                      type="radio"
                      name="crust"
                      id={`crust-${option.id}`}
                      checked={crustId === option.id}
                      onChange={() => setCrustId(option.id)}
                      label={
                        <span>
                          {option.name}
                          {option.priceDelta > 0 && (
                            <span className="text-muted small d-block">
                              +{formatMoney(option.priceDelta)}
                            </span>
                          )}
                        </span>
                      }
                    />
                  </Col>
                ))}
              </Row>
            </section>

            <section className="mb-4">
              <h4 className="h6 fw-bold text-uppercase text-muted">
                Toppings{' '}
                {selectedToppings.length > 0 && (
                  <Badge bg="primary">{selectedToppings.length} selected</Badge>
                )}
              </h4>
              {TOPPING_GROUPS.map((group) => (
                <div key={group.category} className="mb-3">
                  <div className="small fw-semibold mb-1">{group.label}</div>
                  <div className="d-flex flex-wrap gap-2">
                    {MOCK_TOPPINGS.filter((t) => t.category === group.category).map((topping) => {
                      const selected = selectedToppingIds.includes(topping.id);
                      return (
                        <Button
                          key={topping.id}
                          type="button"
                          size="sm"
                          variant={selected ? 'primary' : 'outline-secondary'}
                          className="topping-chip"
                          aria-pressed={selected}
                          onClick={() => toggleTopping(topping.id)}
                        >
                          {topping.name}
                          <span className="ms-1 small opacity-75">
                            +{formatMoney(topping.price)}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        <section>
          <Form.Label htmlFor={quantityId} className="h6 fw-bold text-uppercase text-muted">
            Quantity
          </Form.Label>
          <Form.Select
            id={quantityId}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            style={{ maxWidth: '8rem' }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Form.Select>
        </section>
      </Modal.Body>

      <Modal.Footer className="justify-content-between">
        <div>
          <div className="text-muted small">
            {formatMoney(pricing.unit)} each
          </div>
          <div className="fs-5 fw-bold">{formatMoney(pricing.total)}</div>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button ref={confirmButtonRef} variant="primary" onClick={handleAdd}>
            Add to cart
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
