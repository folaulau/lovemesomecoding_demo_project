import { useEffect } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner, Table } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAppDispatch, useAppSelector } from '../../store';
import { failureMessage } from '../../store/apiFailure';
import {
  changeUserRole,
  deleteUser,
  fetchUsers,
  selectUsers,
  selectUsersError,
  selectUsersLoading,
} from '../../store/usersSlice';
import type { AdminUser } from '../../types';

/**
 * The users tab.
 *
 * Note the deliberate MIX: the user list is Redux (admin data, shared, mutated), while `useAuth`
 * and `useToast` stay on Context. Signed-in identity and toasts belong to the whole app, customer
 * pages included, so moving them into an admin-only store would put them out of reach of every
 * screen that also needs them. "Redux for admin" is about admin DATA, not about banning Context.
 */
export default function AdminUsersPage() {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectUsers);
  const loading = useAppSelector(selectUsersLoading);
  const error = useAppSelector(selectUsersError);

  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    void dispatch(fetchUsers());
  }, [dispatch]);

  async function changeRole(target: AdminUser, role: 'CUSTOMER' | 'ADMIN') {
    try {
      await dispatch(changeUserRole({ id: target.id, role })).unwrap();
      showToast(`${target.email} is now ${role.toLowerCase()}`);
    } catch (err) {
      // The server's own explanation, shown verbatim — refusals here are deliberate
      // ("you cannot demote yourself") and the reason is the useful part.
      showToast(failureMessage(err, 'Could not change that role'), 'danger');
    }
  }

  async function remove(target: AdminUser) {
    try {
      await dispatch(deleteUser(target.id)).unwrap();
      showToast(`${target.email} deleted`, 'danger');
    } catch (err) {
      showToast(failureMessage(err, 'Could not delete that user'), 'danger');
    }
  }

  /*
   * `loading && none yet` rather than plain `loading`. Store state starts empty and the flag only
   * flips once the thunk dispatches, so keying purely off `loading` would flash an empty table for
   * a frame. It also means a REFRESH updates in place instead of replacing the list with a spinner.
   */
  if (loading && users.length === 0) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" role="status">
          <span className="visually-hidden">Loading users…</span>
        </Spinner>
      </div>
    );
  }

  return (
    <>
      <h2 className="h5 fw-bold mb-3">Users · {users.length}</h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Alert variant="light" className="border small">
        Accounts are created by people signing up — there is no "add user" here. What an admin can
        do is change a role or remove an account. Deleting is a <strong>soft delete</strong>:
        past orders still reference the row, and an order has to keep reading correctly long after
        the customer has gone.
      </Alert>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th className="ps-3">User</th>
                <th>Role</th>
                <th className="text-end">Orders</th>
                <th className="text-end">Addresses</th>
                <th className="text-end">Cards</th>
                <th>Joined</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => {
                // An admin cannot demote or delete themselves — with one admin, either would
                // lock them out of their own back office. The server refuses it too; this just
                // avoids offering a button that will always fail.
                const isSelf = row.email.toLowerCase() === currentUser?.email.toLowerCase();

                return (
                  <tr key={row.id}>
                    <td className="ps-3">
                      <div className="fw-semibold">
                        {row.fullName ?? '—'}{' '}
                        {isSelf && (
                          <Badge bg="info" text="dark">
                            you
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted small">{row.email}</div>
                    </td>
                    <td>
                      <Badge bg={row.role === 'ADMIN' ? 'primary' : 'secondary'}>
                        {row.role.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="text-end">{row.orderCount}</td>
                    <td className="text-end">{row.addressCount}</td>
                    <td className="text-end">{row.paymentMethodCount}</td>
                    <td className="small">{new Date(row.createdAt).toLocaleDateString()}</td>
                    <td className="text-end pe-3">
                      <Form.Select
                        size="sm"
                        aria-label={`Role for ${row.email}`}
                        value={row.role}
                        disabled={isSelf}
                        onChange={(e) =>
                          void changeRole(row, e.target.value as 'CUSTOMER' | 'ADMIN')
                        }
                        style={{ minWidth: '9rem', display: 'inline-block', width: 'auto' }}
                      >
                        <option value="CUSTOMER">customer</option>
                        <option value="ADMIN">admin</option>
                      </Form.Select>{' '}
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={isSelf}
                        title={isSelf ? 'You cannot delete your own account' : undefined}
                        onClick={() => void remove(row)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
