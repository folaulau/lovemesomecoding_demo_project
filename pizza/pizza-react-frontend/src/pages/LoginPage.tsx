import { useId, useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, error, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const formId = useId();

  const [email, setEmail] = useState('customer@pizza.test');
  const [password, setPassword] = useState('pizza123');

  /**
   * Where to go after a successful sign-in.
   *
   * ProtectedRoute stashes the attempted location in navigation state, so a user bounced off
   * /admin lands back on /admin rather than on the home page.
   */
  const redirectTo =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch {
      // The error message is already surfaced through AuthContext; nothing to do here.
    }
  }

  return (
    <Container className="py-5">
      <Card className="border-0 shadow-sm mx-auto" style={{ maxWidth: '26rem' }}>
        <Card.Body className="p-4">
          <h1 className="h4 fw-bold mb-3">Sign in</h1>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label htmlFor={`${formId}-email`}>Email</Form.Label>
              <Form.Control
                id={`${formId}-email`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label htmlFor={`${formId}-password`}>Password</Form.Label>
              <Form.Control
                id={`${formId}-password`}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Form.Group>

            <Button type="submit" variant="primary" className="w-100" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Form>

          <hr />
          <p className="small text-muted mb-0">
            Demo accounts — <code>customer@pizza.test</code> / <code>pizza123</code> and{' '}
            <code>admin@pizza.test</code> / <code>admin123</code>.
          </p>
          <p className="small text-muted mb-0 mt-2">
            You never have to sign in to order: checkout works as a guest.
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}
