import { Container, Nav } from 'react-bootstrap';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/admin', label: 'Reports', end: true },
  { to: '/admin/products', label: 'Products', end: false },
  { to: '/admin/toppings', label: 'Toppings', end: false },
  { to: '/admin/crusts', label: 'Crusts', end: false },
  { to: '/admin/orders', label: 'Orders', end: false },
];

/**
 * Shell for every admin screen.
 *
 * <p>REACT ROUTER CONCEPT: a layout route. {@code <Outlet />} is where the matched child route
 * renders, so the heading and tabs are written once instead of being repeated on five pages — and
 * switching tabs never re-mounts the shell.
 */
export default function AdminLayout() {
  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-1">Admin</h1>
      <p className="text-muted">Menu management and reporting.</p>

      <Nav variant="tabs" className="mb-4 admin-nav">
        {TABS.map((tab) => (
          <Nav.Item key={tab.to}>
            <Nav.Link as={NavLink} to={tab.to} end={tab.end}>
              {tab.label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      <Outlet />
    </Container>
  );
}
