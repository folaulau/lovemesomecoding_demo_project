import { memo } from 'react';
import { Button, Card } from 'react-bootstrap';
import type { Product } from '../types';
import { formatMoney } from '../lib/money';

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
}

/* ==========================================================================
 * REACT CONCEPT: React.memo
 *
 * memo skips re-rendering a component when its props are unchanged (compared shallowly).
 *
 * It matters here because the menu renders 14 of these. Without memo, opening the cart drawer —
 * which changes state in a PARENT — would re-render all 14 cards even though not one of their
 * props changed.
 *
 * memo only works if the props are referentially stable. That is exactly why `onSelect` is
 * wrapped in useCallback by the parent: an inline arrow function would be a new object on every
 * render and memo would never hit.
 *
 * Do not reach for memo by default. It costs a comparison on every render and is only worth it
 * for components that are numerous, expensive, or both.
 * ========================================================================== */
export const ProductCard = memo(function ProductCard({ product, onSelect }: Props) {
  const cheapest = Math.min(...product.sizes.map((s) => s.price));
  const isPizza = product.type === 'PIZZA';

  return (
    <Card className="product-card">
      <div className="product-thumb" aria-hidden="true">
        {isPizza ? '🍕' : '🥤'}
      </div>
      <Card.Body className="d-flex flex-column">
        <Card.Title as="h3" className="h6 fw-bold mb-1">
          {product.name}
        </Card.Title>
        <Card.Text className="text-muted small flex-grow-1">{product.description}</Card.Text>
        <div className="d-flex justify-content-between align-items-center mt-2">
          <span className="fw-bold">
            from <span className="text-pizza-red">{formatMoney(cheapest)}</span>
          </span>
          <Button size="sm" variant="primary" onClick={() => onSelect(product)}>
            {isPizza ? 'Build it' : 'Add'}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
});
