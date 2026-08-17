import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * REACT ROUTER CONCEPT: a guarded route.
 *
 * Wraps a page and redirects to /login when the visitor is not allowed to see it.
 *
 * The current location is passed along in navigation state so the login page can send the user
 * back where they were trying to go, instead of dumping them on the home page.
 *
 * `replace` is important: it swaps the current history entry rather than adding one, so pressing
 * Back after logging in does not bounce the user straight back to the redirect.
 *
 * NOTE: this is a usability guard, not a security control. Anyone can edit client-side JavaScript.
 * The real enforcement is the backend rejecting requests without a valid ADMIN token.
 */
export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
