/**
 * The chrome every page sits inside: header, nav, footer.
 *
 * One app serves homeowners and contractors, which is what the README asks for. The nav is the
 * place that difference shows up most — the two roles want different links, and a pro landing on a
 * "Post a project" button is a small but constant reminder that the app was not built for them.
 */

import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { cx } from '../lib/format'
import { Avatar, Button } from './ui'

export function Layout() {
  const { user, isContractor, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // Links differ by role rather than being shown-and-disabled. A nav full of things you cannot use
  // is worse than a shorter one.
  const links = !user
    ? [{ to: '/contractors', label: 'Browse pros' }]
    : isContractor
      ? [
          { to: '/pro/leads', label: 'Find work' },
          { to: '/pro/quotes', label: 'My quotes' },
          { to: '/pro/profile', label: 'My profile' },
        ]
      : [
          { to: '/projects', label: 'My projects' },
          { to: '/contractors', label: 'Browse pros' },
        ]

  function handleSignOut() {
    signOut()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* A skip link is four lines and it is the single highest-value accessibility feature on a
          page with a nav bar — without it, keyboard users tab through every nav link on every
          page before reaching the content. It is visually hidden until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-base"
              aria-hidden="true"
            >
              🔧
            </span>
            Contractor
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cx(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {!isContractor && (
                  <Button size="sm" onClick={() => navigate('/projects/new')} className="hidden sm:inline-flex">
                    Post a project
                  </Button>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
                    <Avatar src={user.avatarUrl} name={user.firstName} className="h-8 w-8" />
                    <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                      {user.firstName}
                    </span>
                  </button>

                  {menuOpen && (
                    <>
                      {/* A full-screen transparent button behind the menu is the cheapest correct
                          click-outside: it catches the next click anywhere, needs no document
                          listener, and cannot leak one on unmount. */}
                      <button
                        type="button"
                        className="fixed inset-0 z-40 cursor-default"
                        aria-label="Close menu"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div
                        role="menu"
                        className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                      >
                        <div className="border-b border-slate-100 px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="truncate text-xs text-slate-500">{user.email}</p>
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-700">
                            {isContractor ? 'Contractor' : 'Homeowner'}
                          </p>
                        </div>
                        {links.map((link) => (
                          <Link
                            key={link.to}
                            to={link.to}
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 md:hidden"
                          >
                            {link.label}
                          </Link>
                        ))}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleSignOut}
                          className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  // Carrying the current path through means signing in returns you to where you
                  // were, rather than dumping you on the home page having forgotten why you came.
                  onClick={() => navigate('/signin', { state: { from: location.pathname } })}
                >
                  Sign in
                </Button>
                <Button size="sm" onClick={() => navigate('/signup')}>
                  Join
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-sm">
              <p className="flex items-center gap-2 font-bold text-slate-900">
                <span aria-hidden="true">🔧</span> Contractor
              </p>
              <p className="mt-2 text-sm text-slate-600">
                A demo marketplace built for lovemesomecoding.com. Post a job, compare quotes from
                local pros, hire the one you want.
              </p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-900">Demo logins</p>
              {/* ⚠️ Acceptable ONLY because these are throwaway local fixtures against a database
                  that is wiped with `docker compose down -v`. If this app ever points at real
                  data, this block is the first thing to delete. */}
              <ul className="mt-2 space-y-1 text-slate-600">
                <li>
                  <code className="text-xs">maya@contractor.test</code> / maya123 — homeowner
                </li>
                <li>
                  <code className="text-xs">luis@contractor.test</code> / luis123 — contractor
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-8 border-t border-slate-100 pt-6 text-xs text-slate-500">
            Not affiliated with Thumbtack. Built as a teaching example.
          </p>
        </div>
      </footer>
    </div>
  )
}
