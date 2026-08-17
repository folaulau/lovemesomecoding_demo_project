import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Toast, ToastContainer } from 'react-bootstrap';

/* ==========================================================================
 * REACT CONCEPT: createPortal
 *
 * A portal renders children into a DOM node OUTSIDE the parent's DOM hierarchy, while keeping
 * them inside the React tree — context and event bubbling still work as if they were nested.
 *
 * Toasts need this. They are triggered from deep inside the page (a button in a modal, say) but
 * must be positioned relative to the viewport. Rendered in place they would be clipped by any
 * ancestor with `overflow: hidden` or trapped under a modal's stacking context. Rendering
 * straight into document.body sidesteps both problems.
 * ========================================================================== */

type ToastVariant = 'success' | 'danger' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, variant }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The second argument is the DOM node to render into. */}
      {createPortal(
        /*
         * top-end, not bottom-end: the cart drawer's Checkout button sits at the bottom-right and
         * a bottom-anchored toast covered it. zIndex clears Bootstrap's offcanvas (1045) and
         * modal (1055) so toasts fired from inside either are still visible.
         */
        <ToastContainer
          className="p-3"
          position="top-end"
          style={{ zIndex: 1100, marginTop: '4rem' }}
        >
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              bg={toast.variant}
              onClose={() => dismiss(toast.id)}
              className="text-white"
            >
              <Toast.Body className="d-flex justify-content-between align-items-center">
                <span>{toast.message}</span>
                <button
                  type="button"
                  className="btn-close btn-close-white ms-3"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(toast.id)}
                />
              </Toast.Body>
            </Toast>
          ))}
        </ToastContainer>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return context;
}
