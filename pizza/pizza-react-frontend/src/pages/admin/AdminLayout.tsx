import { Container, Nav } from 'react-bootstrap';
import { Provider } from 'react-redux';
import { NavLink, Outlet } from 'react-router-dom';
import { store } from '../../store';

const TABS = [
  { to: '/admin', label: 'Reports', end: true },
  { to: '/admin/products', label: 'Products', end: false },
  { to: '/admin/toppings', label: 'Toppings', end: false },
  { to: '/admin/crusts', label: 'Crusts', end: false },
  { to: '/admin/orders', label: 'Orders', end: false },
  { to: '/admin/users', label: 'Users', end: false },
];

/**
 * Shell for every admin screen.
 *
 * <p>REACT ROUTER CONCEPT: a layout route. {@code <Outlet />} is where the matched child route
 * renders, so the heading and tabs are written once instead of being repeated on six pages — and
 * switching tabs never re-mounts the shell.
 *
 * <p>REDUX CONCEPT: where {@code <Provider>} goes. It wraps the admin subtree HERE rather than the
 * whole app in {@code main.tsx}, and that placement is doing two jobs.
 *
 * <p>The first is architectural: the customer-facing pages run on React Context and cannot reach
 * this store even by accident, so "Redux for admin, Context for customers" is enforced by the tree
 * rather than by everyone remembering it.
 *
 * <p>The second is the bundle. This file is behind {@code lazy()} in {@code App.tsx}, so Redux, the
 * slices and their thunks are all pulled into the admin chunk — and the ~99% of visitors who only
 * ever order a pizza download none of it. A {@code <Provider>} in {@code main.tsx} would have
 * dragged the entire store into the entry bundle for everyone.
 *
 * <p>Because the shell does not re-mount between tabs, the store also survives tab switches: the
 * reports slice can hand a cached dashboard straight back instead of showing a spinner again.
 */
export default function AdminLayout() {
  return (
    <Provider store={store}>
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
    </Provider>
  );
}
