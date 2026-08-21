import { NavLink, Route, Routes } from 'react-router-dom'
import { Spinner } from './components/ui'
import { useAuth } from './context/AuthContext'
import { Bookings } from './pages/Bookings'
import { Dashboard } from './pages/Dashboard'
import { Listings } from './pages/Listings'
import { Login } from './pages/Login'
import { Users } from './pages/Users'

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/listings', label: 'Listings' },
  { to: '/bookings', label: 'Bookings' },
  { to: '/users', label: 'Users' },
]

export default function App() {
  const { user, loading, logout } = useAuth()

  // ⚠️ Gate on `loading` before deciding anyone is signed out. Reviving a session is an async
  // call, so `user` is null on the first render even for a signed-in admin — showing the login
  // form here flashes it on every reload.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    )
  }

  // The whole console is behind auth, so there is no route-by-route guard: no user, no app.
  // That is simpler AND stricter than gating each page, because a new page cannot forget it.
  if (!user) return <Login />

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <svg className="h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.6c-.7 0-1.3.4-1.6 1L3.2 17.9c-.7 1.4.3 3 1.9 3h13.8c1.6 0 2.6-1.6 1.9-3L13.6 3.6a1.8 1.8 0 0 0-1.6-1zm0 4.2 5.6 11.4H6.4z" />
            </svg>
            <span className="font-extrabold tracking-tight">
              stayhub <span className="font-semibold text-brand-500">admin</span>
            </span>
          </div>

          <nav className="hidden gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-600 sm:inline">{user.fullName}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 ring-1 ring-ink-300 transition hover:bg-ink-100"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="flex gap-1 border-t border-ink-200 px-4 pb-2 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/users" element={<Users />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  )
}
