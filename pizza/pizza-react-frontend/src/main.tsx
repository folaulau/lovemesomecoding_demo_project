import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Bootstrap's stylesheet first, then our theme, so our overrides win on equal specificity.
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';

import App from './App.tsx';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { MenuProvider } from './context/MenuContext';

/*
 * Provider order matters only where one provider consumes another. These four are independent,
 * so the nesting is chosen for readability: auth outermost (longest-lived), then the menu
 * catalogue, then the cart, then toasts (which anything may fire).
 *
 * StrictMode intentionally double-invokes renders and effects in DEVELOPMENT ONLY. It is not a
 * bug — it is how React surfaces impure renders and missing effect cleanups. It does not happen
 * in the production build.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MenuProvider>
          <CartProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </CartProvider>
        </MenuProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
