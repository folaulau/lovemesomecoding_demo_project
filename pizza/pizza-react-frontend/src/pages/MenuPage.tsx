import { useCallback, useMemo, useState } from 'react';
import { Col, Container, Nav, Row } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { PizzaBuilderModal } from '../components/PizzaBuilderModal';
import { MOCK_MENU } from '../mocks/menu';
import type { Product, ProductType } from '../types';

type Filter = 'ALL' | ProductType;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'ALL', label: 'Everything' },
  { key: 'PIZZA', label: 'Pizzas' },
  { key: 'DRINK', label: 'Drinks' },
];

export function MenuPage() {
  /*
   * REACT ROUTER CONCEPT: useSearchParams
   *
   * The active filter lives in the URL rather than in component state, so /menu?type=PIZZA is
   * shareable, bookmarkable, and survives a refresh. Treating the URL as state is usually the
   * right call for anything a user might want to link to.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = (searchParams.get('type') as Filter) ?? 'ALL';

  // `null` means the modal is closed. One piece of state, not two.
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  /*
   * REACT CONCEPT: useMemo
   * Recompute the filtered list only when the filter changes — not on every re-render caused by
   * opening the modal or the cart drawer.
   */
  const visibleProducts = useMemo(() => {
    if (activeFilter === 'ALL') return MOCK_MENU;
    return MOCK_MENU.filter((product) => product.type === activeFilter);
  }, [activeFilter]);

  /*
   * REACT CONCEPT: useCallback
   * ProductCard is wrapped in React.memo, which compares props by reference. Passing an inline
   * arrow here would create a brand-new function on every render, so every card would see a
   * "changed" prop and re-render — memo would do nothing but waste a comparison.
   */
  const handleSelect = useCallback((product: Product) => {
    setSelectedProduct(product);
  }, []);

  const handleFilter = useCallback(
    (filter: Filter) => {
      if (filter === 'ALL') {
        setSearchParams({});
      } else {
        setSearchParams({ type: filter });
      }
    },
    [setSearchParams],
  );

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-3">Menu</h1>

      <Nav variant="tabs" activeKey={activeFilter} className="mb-4">
        {FILTERS.map((filter) => (
          <Nav.Item key={filter.key}>
            <Nav.Link eventKey={filter.key} onClick={() => handleFilter(filter.key)}>
              {filter.label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      <Row xs={1} sm={2} lg={4} className="g-4">
        {visibleProducts.map((product) => (
          <Col key={product.id}>
            <ProductCard product={product} onSelect={handleSelect} />
          </Col>
        ))}
      </Row>

      <PizzaBuilderModal product={selectedProduct} onHide={() => setSelectedProduct(null)} />
    </Container>
  );
}
