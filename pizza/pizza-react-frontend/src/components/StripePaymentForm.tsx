import { useState } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { formatMoney } from '../lib/money';

interface Props {
  total: number;
  onSuccess: () => void;
}

/**
 * The card form.
 *
 * <p>Must render INSIDE an {@code <Elements>} provider — {@code useStripe} and {@code useElements}
 * read from its context and return null otherwise.
 *
 * <p>The card number never touches our servers or even our JavaScript: {@code PaymentElement}
 * renders an iframe hosted by Stripe, so the details go straight from the customer's browser to
 * Stripe. That is what keeps this app out of PCI scope.
 */
export function StripePaymentForm({ total, onSuccess }: Props) {
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Both are null until Stripe.js has finished loading.
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      /*
       * `if_required` keeps the customer inside our SPA for ordinary card payments, and only
       * redirects when the payment method genuinely demands it — 3D Secure, or a bank redirect.
       * `return_url` is where Stripe sends them back to in that case.
       */
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/checkout`,
      },
    });

    if (result.error) {
      // card_error and validation_error are safe to show; anything else is a generic message,
      // because the detail can leak information about the payment infrastructure.
      const message =
        result.error.type === 'card_error' || result.error.type === 'validation_error'
          ? (result.error.message ?? 'Your card was declined.')
          : 'Something went wrong taking the payment. Please try again.';
      setError(message);
      setSubmitting(false);
      return;
    }

    /*
     * Success here means Stripe accepted the payment. Our order is still PENDING_PAYMENT until
     * the backend hears about it — via the webhook, or via the confirmation page polling
     * /payment-status. We never mark an order paid from the browser: anyone can call our API.
     */
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />

      {error && (
        <Alert variant="danger" className="mt-3 mb-0">
          {error}
        </Alert>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-100 mt-3"
        disabled={!stripe || submitting}
      >
        {submitting ? (
          <>
            <Spinner as="span" animation="border" size="sm" className="me-2" />
            Processing…
          </>
        ) : (
          `Pay ${formatMoney(total)}`
        )}
      </Button>

      <p className="small text-muted mt-2 mb-0">
        Test mode — use card <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
      </p>
    </form>
  );
}
