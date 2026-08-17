import { Suspense, lazy, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { AppNavbar } from './components/AppNavbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { MenuPage } from './pages/MenuPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OrdersPage } from './pages/OrdersPage';

/* ==========================================================================
 * REACT CONCEPT: lazy + Suspense (code splitting)
 *
 * React.lazy turns this import into a separate bundle that is fetched only when the route is
 * first visited. Customers — the overwhelming majority of visitors — never open /admin, so its
 * code should not be part of the JavaScript everyone downloads on the home page.
 *
 * Because the import is asynchronous, React needs something to show while it is in flight: that
 * is what the <Suspense fallback> below provides.
 *
 * The lazily-imported module must have a DEFAULT export.
 * ========================================================================== */
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminToppingsPage = lazy(() => import('./pages/admin/AdminToppingsPage'));
const AdminCrustsPage = lazy(() => import('./pages/admin/AdminCrustsPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));

export default function App() {
  // The drawer's open/closed state lives here because both the navbar (which opens it) and the
  // drawer itself need it. This is "lifting state up" — the cart CONTENTS are in context, but
  // this piece of purely-visual state is not worth putting there.
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="d-flex flex-column min-vh-100">
      <AppNavbar onOpenCart={() => setCartOpen(true)} />

      <main className="flex-grow-1">
        {/* Any render error inside a route is caught here rather than blanking the whole app. */}
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="text-center py-5">
                <Spinner animation="border" variant="danger" role="status">
                  <span className="visually-hidden">Loading…</span>
                </Spinner>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Signed-in customers only. */}
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />

              {/*
                Signed-in ADMINS only.

                REACT ROUTER CONCEPT: a layout route. AdminLayout renders the shell plus an
                <Outlet />; the children below render into it. Guarding the PARENT means every
                admin page inherits the check — a new tab cannot be added unprotected by accident.
              */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                {/* `index` is the route shown at /admin itself. */}
                <Route index element={<AdminReportsPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="toppings" element={<AdminToppingsPage />} />
                <Route path="crusts" element={<AdminCrustsPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
              </Route>

              <Route
                path="*"
                element={
                  <div className="container py-5 text-center">
                    <h1 className="h4">Page not found</h1>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <CartDrawer show={cartOpen} onHide={() => setCartOpen(false)} />
      <Footer />
    </div>
  );
}
