import { ApolloProvider } from '@apollo/client/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
import { apolloClient } from './lib/apollo'
import { AuthProvider } from './lib/auth'
import './index.css'

const rootElement = document.getElementById('root')
// A non-null assertion (`!`) is the usual line here. Throwing instead costs one line and turns a
// blank page plus a cryptic "Cannot read properties of null" into a sentence that names the cause.
if (!rootElement) throw new Error('index.html is missing <div id="root">')

createRoot(rootElement).render(
  <StrictMode>
    {/* ApolloProvider is outermost because it depends on nothing else. It is here at all even
        though `api/client.ts` uses the client imperatively — any component that later reaches for
        `useQuery` needs it in context, and discovering that through a runtime error is a wasted
        five minutes. */}
    <ApolloProvider client={apolloClient}>
      <BrowserRouter>
        {/* AuthProvider sits INSIDE the router on purpose: signing out navigates, and a provider
            above <BrowserRouter> cannot call useNavigate. */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
)
