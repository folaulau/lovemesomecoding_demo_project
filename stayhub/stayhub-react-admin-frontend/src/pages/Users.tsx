import { useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { Button, EmptyState, PageHeader, Spinner, TableShell } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { GET_ALL_USERS } from '../graphql/queries'
import type { GetAllUsersResult } from '../graphql/results'
import { adminApi } from '../lib/api'
import { formatDate } from '../lib/format'

export function Users() {
  const { data, loading, error, refetch } = useQuery<GetAllUsersResult>(GET_ALL_USERS)
  const { user: me } = useAuth()
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function deactivate(publicId: string, name: string) {
    // A genuinely destructive action gets a confirmation. It soft-deletes the account AND
    // unpublishes their listings.
    if (!window.confirm(`Deactivate ${name}? Their listings will be taken down too.`)) return

    setBusy(publicId)
    try {
      const result = await adminApi.deactivateUser(publicId)
      toast(result.message, 'success')
      await refetch()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    )
  }

  if (error) return <EmptyState message={`Could not load users: ${error.message}`} />

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Email addresses are visible only to the staff role — no other role can select that column."
      />

      <TableShell headers={['Name', 'Email', 'Role', 'Listings', 'Bookings', 'Joined', '']}>
        {(data?.users ?? []).map((user) => {
          const isMe = user.publicId === me?.publicId
          return (
            <tr key={user.publicId} data-testid={`user-${user.publicId}`}>
              <td className="px-4 py-3 font-medium text-ink-900">
                {user.firstName} {user.lastName}
                {isMe && <span className="ml-2 text-xs font-normal text-ink-400">(you)</span>}
              </td>
              <td className="px-4 py-3 text-ink-700">{user.email}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {user.role === 'ADMIN' && (
                    <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      Staff
                    </span>
                  )}
                  {user.isHost && (
                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                      Host
                    </span>
                  )}
                  {user.role === 'CUSTOMER' && !user.isHost && (
                    <span className="rounded-full bg-ink-200 px-2.5 py-0.5 text-xs font-semibold text-ink-600">
                      Guest
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-ink-700">
                {user.propertiesAggregate?.aggregate?.count ?? 0}
              </td>
              <td className="px-4 py-3 text-ink-700">
                {user.bookingsAggregate?.aggregate?.count ?? 0}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">
                {formatDate(user.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                {isMe ? (
                  // ⚠️ Staff cannot deactivate themselves. With one admin that locks everyone out
                  // permanently and the only way back is a SQL prompt. The API enforces this too —
                  // hiding the button is the courtesy, not the rule.
                  <span className="text-xs text-ink-400">—</span>
                ) : (
                  <Button
                    variant="danger"
                    loading={busy === user.publicId}
                    onClick={() => deactivate(user.publicId, `${user.firstName} ${user.lastName}`)}
                  >
                    Deactivate
                  </Button>
                )}
              </td>
            </tr>
          )
        })}
      </TableShell>
    </>
  )
}
