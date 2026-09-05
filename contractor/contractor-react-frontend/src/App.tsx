/**
 * Routes, and who is allowed down each of them.
 *
 * ⚠️ `RequireAuth` below is a CONVENIENCE, not a security boundary. Everything it does happens in
 * JavaScript the user controls, so it stops honest mistakes and nothing else. The real enforcement
 * is Hasura's row-level permissions on reads and the guards in NestJS on writes; a pro who edits
 * their bundle to reach `/projects` still gets nothing back from the API.
 */

import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { useAuth } from './lib/auth'
import { UserRole } from './types/domain'

import { ContractorDetailPage } from './pages/ContractorDetailPage'
import { ContractorsPage } from './pages/ContractorsPage'
import { HomePage } from './pages/HomePage'
import { NewProjectPage } from './pages/NewProjectPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { LeadDetailPage } from './pages/pro/LeadDetailPage'
import { LeadsPage } from './pages/pro/LeadsPage'
import { ProProfilePage } from './pages/pro/ProProfilePage'
import { ProQuotesPage } from './pages/pro/ProQuotesPage'

function RequireAuth({ role, children }: { role?: UserRole; children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  // ⚠️ Without this branch, a hard refresh on a guarded page bounces to sign-in: the first render
  // happens before `localStorage` has been read, so `user` is legitimately null for one tick.
  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-700" />
      </div>
    )
  }

  if (!user) {
    // `replace` keeps the guarded URL out of history, so Back from the sign-in page does not
    // bounce the user straight back to the wall they just hit.
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }

  // Wrong role is sent home rather than to sign-in — they ARE signed in, and offering the login
  // form to someone already logged in is the more confusing of the two dead ends.
  if (role && user.role !== role) return <Navigate to="/" replace />

  return <>{children}</>
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="signin" element={<SignInPage />} />
        <Route path="signup" element={<SignUpPage />} />

        {/* Public: browsing pros needs no account, the same way Thumbtack lets you look first. */}
        <Route path="contractors" element={<ContractorsPage />} />
        <Route path="contractors/:contractorId" element={<ContractorDetailPage />} />

        {/* Homeowners */}
        <Route
          path="projects"
          element={
            <RequireAuth role={UserRole.HOMEOWNER}>
              <ProjectsPage />
            </RequireAuth>
          }
        />
        <Route
          path="projects/new"
          element={
            <RequireAuth role={UserRole.HOMEOWNER}>
              <NewProjectPage />
            </RequireAuth>
          }
        />
        <Route
          path="projects/:projectId"
          element={
            <RequireAuth role={UserRole.HOMEOWNER}>
              <ProjectDetailPage />
            </RequireAuth>
          }
        />

        {/* Contractors */}
        <Route
          path="pro/leads"
          element={
            <RequireAuth role={UserRole.CONTRACTOR}>
              <LeadsPage />
            </RequireAuth>
          }
        />
        <Route
          path="pro/leads/:projectId"
          element={
            <RequireAuth role={UserRole.CONTRACTOR}>
              <LeadDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="pro/quotes"
          element={
            <RequireAuth role={UserRole.CONTRACTOR}>
              <ProQuotesPage />
            </RequireAuth>
          }
        />
        <Route
          path="pro/profile"
          element={
            <RequireAuth role={UserRole.CONTRACTOR}>
              <ProProfilePage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
