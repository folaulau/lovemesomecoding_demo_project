import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Footer } from './components/Footer'
import { SpinnerIcon } from './components/Icons'
import { Navbar } from './components/Navbar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BecomeHost } from './pages/BecomeHost'
import { Home } from './pages/Home'
import { ListingDetail } from './pages/ListingDetail'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { SearchResults } from './pages/SearchResults'
import { Trips } from './pages/Trips'

/** Lazy-loaded routes.
 *
 * Checkout pulls in Stripe.js and @stripe/react-stripe-js — a meaningful chunk that a visitor
 * browsing listings should never download. The /hosts pages are the same argument: most visitors
 * are guests. `lazy` + `Suspense` is what keeps the first paint small.
 */
const Checkout = lazy(() => import('./pages/Checkout').then((m) => ({ default: m.Checkout })))
const HostDashboard = lazy(() =>
  import('./pages/hosts/HostDashboard').then((m) => ({ default: m.HostDashboard })),
)
const HostListings = lazy(() =>
  import('./pages/hosts/HostListings').then((m) => ({ default: m.HostListings })),
)
const HostReservations = lazy(() =>
  import('./pages/hosts/HostReservations').then((m) => ({ default: m.HostReservations })),
)
const NewListing = lazy(() =>
  import('./pages/hosts/NewListing').then((m) => ({ default: m.NewListing })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <SpinnerIcon className="h-7 w-7 text-brand-500" />
    </div>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* The boundary sits INSIDE the layout so a crash on one page keeps the navbar — the
            user can navigate away instead of being stranded on a blank screen. */}
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/listings/:id" element={<ListingDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/become-a-host" element={<BecomeHost />} />

              <Route
                path="/checkout/:bookingId"
                element={
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trips"
                element={
                  <ProtectedRoute>
                    <Trips />
                  </ProtectedRoute>
                }
              />

              {/* Host routes live under /hosts/*, gated on the is_host FLAG rather than a role —
                  hosting is a mode of a normal account, not a privilege level. */}
              <Route
                path="/hosts/dashboard"
                element={
                  <ProtectedRoute requireHost>
                    <HostDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hosts/listings"
                element={
                  <ProtectedRoute requireHost>
                    <HostListings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hosts/listings/new"
                element={
                  <ProtectedRoute requireHost>
                    <NewListing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hosts/reservations"
                element={
                  <ProtectedRoute requireHost>
                    <HostReservations />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-ink-900">Nothing here</h1>
      <p className="mt-2 text-sm text-ink-600">That page does not exist.</p>
    </div>
  )
}
