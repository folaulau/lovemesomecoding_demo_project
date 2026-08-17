import { useId, useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register, error, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const formId = useId();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /** Honour the destination a guard stashed, exactly as the login page does. */
  const redirectTo =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await register(email, password, fullName);
      navigate(redirectTo, { replace: true });
    } catch {
      // The message is already surfaced through AuthContext.
    }
  }

  return (
    <Container className="py-5">
      <Card className="border-0 shadow-sm mx-auto" style={{ maxWidth: '26rem' }}>
        <Card.Body className="p-4">
          <h1 className="h4 fw-bold mb-3">Create an account</h1>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label htmlFor={`${formId}-name`}>Full name</Form.Label>
              <Form.Control
                id={`${formId}-name`}
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </Form.Group>

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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Form.Text muted>At least 8 characters.</Form.Text>
            </Form.Group>

            <Button type="submit" variant="primary" className="w-100" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </Form>

          <hr />
          <p className="small text-muted mb-0">
            Already have an account? <Link to="/login">Sign in</Link>.
          </p>
          <p className="small text-muted mb-0 mt-2">
            {/*
              Worth saying out loud on this page: registering is never required. The whole guest
              checkout path exists so nobody has to create an account to buy a pizza.
            */}
            You can also order without an account — just add a pizza and check out.
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}
