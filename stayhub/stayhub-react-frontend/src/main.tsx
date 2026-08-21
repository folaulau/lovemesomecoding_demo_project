import { ApolloProvider } from '@apollo/client/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'
import { apolloClient } from './lib/apollo'

/** Provider order matters.
 *
 * ApolloProvider is OUTSIDE AuthProvider because AuthContext calls `resetApolloAfterAuthChange`
 * on sign-in and sign-out. That function reaches the client through a module import rather than
 * through context, so the nesting is not strictly required — but keeping the data layer outermost
 * matches how the dependencies actually run, and stops the next person nesting them the other way
 * and wondering why the cache is not cleared.
 *
 * BrowserRouter is inside both so `useNavigate` works in any page, and toasts sit closest to the
 * app because nothing else depends on them.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </AuthProvider>
    </ApolloProvider>
  </StrictMode>,
)
