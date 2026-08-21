import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SpinnerIcon } from './Icons'

/** Route guard.
 *
 * ⚠️ The `loading` check is the load-bearing part. Reviving a session means an async call to
 * /auth/me, so on the very first render `user` is null even for someone signed in. Redirecting
 * without waiting bounces every signed-in user to the login page on every hard refresh — a bug
 * that never appears while clicking around, only on reload.
 */
export function ProtectedRoute({
  children,
  requireHost = false,
}: {
  children: React.ReactNode
  requireHost?: boolean
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <SpinnerIcon className="h-7 w-7 text-brand-500" />
      </div>
    )
  }

  if (!user) {
    // `state` carries where they were going, and `replace` keeps the guarded URL out of history
    // so Back from the login page does not bounce them straight into the guard again.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (requireHost && !user.isHost) return <Navigate to="/become-a-host" replace />

  return <>{children}</>
}
