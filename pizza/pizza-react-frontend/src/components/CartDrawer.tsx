import { Badge, Button, ButtonGroup, Offcanvas, Stack } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatMoney, lineTotal, unitPrice } from '../lib/money';

/**
 * The cart, in a Bootstrap Offcanvas (a slide-in drawer).
 *
 * Offcanvas handles the backdrop, the escape key and focus trapping, which is a meaningful
 * amount of accessibility work not to have to write.
 */
export function CartDrawer({ show, onHide }: { show: boolean; onHide: () => void }) {
  const { items, totals, orderType, setOrderType, setQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  function goToCheckout() {
    onHide();
    navigate('/checkout');
  }

  return (
    <Offcanvas show={show} onHide={onHide} placement="end">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Your order</Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body className="d-flex flex-column">
        <ButtonGroup className="mb-3 w-100">
          <Button
            variant={orderType === 'DELIVERY' ? 'primary' : 'outline-primary'}
            onClick={() => setOrderType('DELIVERY')}
          >
            Delivery
          </Button>
          <Button
            variant={orderType === 'CARRYOUT' ? 'primary' : 'outline-primary'}
            onClick={() => setOrderType('CARRYOUT')}
          >
            Carryout
          </Button>
        </ButtonGroup>

        {items.length === 0 ? (
          <div className="text-center text-muted py-5">
            <div className="display-6 mb-2">🍕</div>
            <p className="mb-0">Your cart is empty.</p>
          </div>
        ) : (
          <>
            <Stack gap={3} className="flex-grow-1 overflow-auto">
              {items.map((item) => (
                <div key={item.lineId} className="border-bottom pb-3">
                  <div className="d-flex justify-content-between">
                    <div className="pe-2">
                      <div className="fw-semibold">{item.productName}</div>
                      <div className="small text-muted">
                        {item.size.charAt(0) + item.size.slice(1).toLowerCase()}
                        {item.crustName ? ` · ${item.crustName}` : ''}
                      </div>
                      {item.toppings.length > 0 && (
                        <div className="mt-1 d-flex flex-wrap gap-1">
                          {item.toppings.map((topping) => (
                            <Badge key={topping.id} bg="light" text="dark">
                              {topping.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="small text-muted mt-1">
                        {formatMoney(unitPrice(item))} each
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold">{formatMoney(lineTotal(item))}</div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 mt-2">
                    <ButtonGroup size="sm">
                      <Button
                        variant="outline-secondary"
                        onClick={() => setQuantity(item.lineId, item.quantity - 1)}
                        aria-label={`Decrease quantity of ${item.productName}`}
                      >
                        −
                      </Button>
                      <Button variant="outline-secondary" disabled style={{ minWidth: '2.5rem' }}>
                        {item.quantity}
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={() => setQuantity(item.lineId, item.quantity + 1)}
                        aria-label={`Increase quantity of ${item.productName}`}
                      >
                        +
                      </Button>
                    </ButtonGroup>
                    <Button
                      size="sm"
                      variant="link"
                      className="text-danger text-decoration-none"
                      onClick={() => removeItem(item.lineId)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </Stack>

            <div className="border-top pt-3 mt-3">
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

              <Button variant="primary" className="w-100 mt-3" onClick={goToCheckout}>
                Checkout
              </Button>
            </div>
          </>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}
