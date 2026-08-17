import { Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { MOCK_PIZZAS } from '../mocks/menu';
import { formatMoney } from '../lib/money';

/*
 * Note on the call-to-action links below.
 *
 * react-bootstrap's <Button as={Link}> does not typecheck in v2 — its `as` prop is typed against
 * intrinsic elements, so passing Router's Link fails. Rendering a <Link> with Bootstrap's own
 * `btn` classes produces identical markup and styling with no casts, and it stays semantically
 * correct: these navigate somewhere, so they should be anchors, not buttons.
 */
export function HomePage() {
  const featured = MOCK_PIZZAS.slice(0, 3);

  return (
    <>
      <section className="pizza-hero">
        <Container>
          <Row className="align-items-center g-4">
            <Col lg={7}>
              <h1 className="display-4">No One OutPizzas the Hub</h1>
              <p className="lead mb-4">
                Hand-stretched dough, real mozzarella, and toppings piled on until it stops being
                sensible. Delivery or carryout, in about 25 minutes.
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <Link to="/menu" className="btn btn-primary btn-lg">
                  Order now
                </Link>
                <Link to="/menu?type=DRINK" className="btn btn-outline-light btn-lg">
                  Add a drink
                </Link>
              </div>
            </Col>
            <Col lg={5} className="text-center d-none d-lg-block">
              <div style={{ fontSize: '10rem', lineHeight: 1 }} aria-hidden="true">
                🍕
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <Container className="py-5">
        <h2 className="h4 fw-bold mb-4">Popular right now</h2>
        <Row xs={1} md={3} className="g-4">
          {featured.map((pizza) => (
            <Col key={pizza.id}>
              <Card className="product-card">
                <div className="product-thumb" aria-hidden="true">
                  🍕
                </div>
                <Card.Body>
                  <Card.Title as="h3" className="h6 fw-bold">
                    {pizza.name}
                  </Card.Title>
                  <Card.Text className="text-muted small">{pizza.description}</Card.Text>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-pizza-red">
                      from {formatMoney(Math.min(...pizza.sizes.map((s) => s.price)))}
                    </span>
                    <Link to="/menu" className="btn btn-outline-primary btn-sm">
                      Build it
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </>
  );
}
