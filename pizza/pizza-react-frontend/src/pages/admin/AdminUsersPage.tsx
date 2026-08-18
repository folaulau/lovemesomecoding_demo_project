import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner, Table } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { adminApi } from '../../lib/adminApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { AdminUser } from '../../types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await adminApi.listUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(target: AdminUser, role: 'CUSTOMER' | 'ADMIN') {
    try {
      await adminApi.changeUserRole(target.id, role);
      showToast(`${target.email} is now ${role.toLowerCase()}`);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not change that role', 'danger');
    }
  }

  async function remove(target: AdminUser) {
    try {
      await adminApi.deleteUser(target.id);
      showToast(`${target.email} deleted`, 'danger');
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete that user', 'danger');
    }
  }

  if (loading) {
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
