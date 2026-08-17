import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';

/* ==========================================================================
 * REACT CONCEPT: Error Boundary
 *
 * This is the one thing that still REQUIRES a class component. There is no hook equivalent of
 * componentDidCatch, so even a fully modern React codebase keeps one class like this.
 *
 * Without a boundary, an exception thrown while rendering unmounts the entire React tree and the
 * user gets a blank white page. The boundary catches it and renders a fallback instead.
 *
 * What it does NOT catch: errors in event handlers, in async code, or during server rendering.
 * Those still need ordinary try/catch.
 * ========================================================================== */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  /** Runs during the render phase and decides the new state — must stay side-effect free. */
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  /** Runs after the error is committed. This is where logging belongs. */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In production this would go to Sentry, Datadog or similar.
    console.error('Uncaught render error:', error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <Container className="py-5">
          <Alert variant="danger">
            <Alert.Heading>Something went wrong</Alert.Heading>
            <p className="mb-3">
              Sorry — this part of the page failed to load. Your cart has not been lost.
            </p>
            <pre className="small bg-light p-2 rounded overflow-auto">
              {this.state.error.message}
            </pre>
            <Button variant="outline-danger" onClick={this.handleReset}>
              Try again
            </Button>
          </Alert>
        </Container>
      );
    }

    return this.props.children;
  }
}
