import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

/**
 * Site footer, including a collapsed panel of demo sign-ins.
 *
 * <p>Putting credentials on the page is normally indefensible. It is fine HERE, and only here,
 * because these two accounts are seeded fixtures in a throwaway demo database — the same pair the
 * login page already prints. Nothing they unlock exists outside this machine.
 *
 * <p>If this app ever pointed at real data, this block is the first thing to delete.
 *
 * <p>Built on native {@code <details>}/{@code <summary>} rather than a JS accordion: the browser
 * gives the open/close behaviour, keyboard support and screen-reader semantics for free.
 */
export function Footer() {
  return (
    <footer className="bg-pizza-black text-white-50 mt-5 py-4">
      <Container>
        <details className="demo-logins mb-3">
          <summary>Demo sign-ins</summary>

          <div className="mt-2 small">
            <div className="mb-2">
              <span className="badge bg-primary me-2">admin</span>
              <code>admin@pizza.test</code> / <code>admin123</code>
              <span className="d-block text-white-50">
                Unlocks the Admin tab — reports, menu management and orders.
              </span>
            </div>

            <div>
              <span className="badge bg-secondary me-2">customer</span>
              <code>customer@pizza.test</code> / <code>pizza123</code>
              <span className="d-block text-white-50">
                Saved addresses, order history and a saved card.
              </span>
            </div>

            <div className="mt-2 text-white-50">
              You can also order without signing in at all — guest checkout works end to end.
            </div>
          </div>
        </details>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 small">
          <span>PizzaHub — a demo app for lovemesomecoding.com</span>
          {/*
            Linked from the footer rather than the navbar on purpose: the navbar has to keep looking
            like a pizza chain's, and a "Interview questions" tab beside "Menu" would break that.
            Anyone who wants it will look down here or follow a direct link.
          */}
          <Link to="/interview-questions" className="link-light">
            Senior interview questions
          </Link>
          <span>Not a real restaurant. Please do not expect a pizza.</span>
        </div>
      </Container>
    </footer>
  );
}
