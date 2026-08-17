import { Badge, Button, Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

/**
 * Top navigation.
 *
 * Reads the cart badge straight from context rather than receiving it as a prop — the whole
 * reason CartContext exists. The navbar is nowhere near the menu page in the component tree,
 * yet it stays in sync automatically.
 */
export function AppNavbar({ onOpenCart }: { onOpenCart: () => void }) {
  const { totals } = useCart();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <Navbar expand="lg" variant="dark" className="pizza-navbar sticky-top" collapseOnSelect>
      <Container>
        <Navbar.Brand as={Link} to="/" className="pizza-brand">
          Pizza<span>Hub</span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-nav" />

        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            {/*
              NavLink (not Link) gets an isActive flag, so the current section can be
              highlighted without manually comparing to the URL.
            */}
            <Nav.Link as={NavLink} to="/menu" end>
              Menu
            </Nav.Link>
            <Nav.Link as={NavLink} to="/menu?type=PIZZA">
              Pizzas
            </Nav.Link>
            <Nav.Link as={NavLink} to="/menu?type=DRINK">
              Drinks
            </Nav.Link>
            {isAdmin && (
              <Nav.Link as={NavLink} to="/admin">
                Admin
              </Nav.Link>
            )}
          </Nav>

          <Nav className="align-items-lg-center gap-2">
            {isAuthenticated ? (
              <NavDropdown
                title={user?.fullName ?? user?.email ?? 'Account'}
                id="account-menu"
                align="end"
              >
                <NavDropdown.Item as={Link} to="/orders">
                  My orders
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={logout}>Sign out</NavDropdown.Item>
              </NavDropdown>
            ) : (
              <Nav.Link as={NavLink} to="/login">
                Sign in
              </Nav.Link>
            )}

            <Button
              variant="primary"
              className="position-relative"
              onClick={onOpenCart}
              aria-label={`Open cart, ${totals.itemCount} items`}
            >
              Cart
              {totals.itemCount > 0 && (
                <Badge bg="light" text="dark" pill className="cart-badge">
                  {totals.itemCount}
                </Badge>
              )}
            </Button>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
