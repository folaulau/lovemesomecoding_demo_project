import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CloseIcon, MenuIcon, UserIcon } from './Icons'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the dropdown on an outside click or on Escape. Both are expected of a menu, and
  // omitting the Escape half is what makes a custom menu feel unfinished to keyboard users.
  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    // ⚠️ The cleanup is the whole point of returning a function here. Without it every open/close
    // cycle adds another pair of listeners that never go away.
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  function signOut() {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-brand-500">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.6c-.7 0-1.3.4-1.6 1L3.2 17.9c-.7 1.4.3 3 1.9 3h13.8c1.6 0 2.6-1.6 1.9-3L13.6 3.6a1.8 1.8 0 0 0-1.6-1zm0 4.2 5.6 11.4H6.4z" />
          </svg>
          <span className="text-lg font-extrabold tracking-tight text-ink-900">
            stay<span className="text-brand-500">hub</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-700 hover:bg-ink-50'
              }`
            }
          >
            Stays
          </NavLink>
          {user?.isHost ? (
            <NavLink
              to="/hosts/dashboard"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-700 hover:bg-ink-50'
                }`
              }
            >
              Hosting
            </NavLink>
          ) : (
            <Link
              to="/become-a-host"
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              StayHub your home
            </Link>
          )}
        </nav>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            // A menu button must say what it controls and whether it is open, or a screen reader
            // announces an unlabelled button with no state.
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={user ? `Account menu for ${user.firstName}` : 'Account menu'}
            className="flex items-center gap-2 rounded-full border border-ink-300 py-1.5 pl-3 pr-1.5 transition hover:shadow-md"
          >
            {menuOpen ? <CloseIcon className="h-4 w-4 text-ink-700" /> : <MenuIcon className="h-4 w-4 text-ink-700" />}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-600 text-xs font-bold text-white">
              {user ? user.firstName[0].toUpperCase() : <UserIcon className="h-4 w-4" />}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-ink-200 bg-white py-2 shadow-xl"
            >
              {user ? (
                <>
                  <div className="border-b border-ink-100 px-4 pb-2.5">
                    <p className="text-sm font-semibold text-ink-900">{user.fullName}</p>
                    <p className="truncate text-xs text-ink-500">{user.email}</p>
                  </div>
                  <MenuLink to="/trips" onClick={() => setMenuOpen(false)}>My trips</MenuLink>
                  {user.isHost ? (
                    <>
                      <MenuLink to="/hosts/dashboard" onClick={() => setMenuOpen(false)}>Hosting dashboard</MenuLink>
                      <MenuLink to="/hosts/listings" onClick={() => setMenuOpen(false)}>My listings</MenuLink>
                      <MenuLink to="/hosts/reservations" onClick={() => setMenuOpen(false)}>Reservations</MenuLink>
                    </>
                  ) : (
                    <MenuLink to="/become-a-host" onClick={() => setMenuOpen(false)}>Become a host</MenuLink>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                    className="mt-1 w-full border-t border-ink-100 px-4 pb-1 pt-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <MenuLink to="/register" onClick={() => setMenuOpen(false)} bold>Sign up</MenuLink>
                  <MenuLink to="/login" onClick={() => setMenuOpen(false)}>Log in</MenuLink>
                  <div className="my-1 border-t border-ink-100" />
                  <MenuLink to="/become-a-host" onClick={() => setMenuOpen(false)}>StayHub your home</MenuLink>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuLink({
  to,
  onClick,
  bold,
  children,
}: {
  to: string
  onClick: () => void
  bold?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className={`block px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 ${bold ? 'font-semibold text-ink-900' : ''}`}
    >
      {children}
    </Link>
  )
}
