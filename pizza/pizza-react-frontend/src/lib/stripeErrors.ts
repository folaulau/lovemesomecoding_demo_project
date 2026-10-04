import type { StripeError } from '@stripe/stripe-js';

/**
 * The message to show a customer when Stripe refuses a payment.
 *
 * card_error and validation_error are about the customer's own card or input — "Your card was
 * declined", "Your card's security code is incorrect" — so they are safe and useful to show.
 * Anything else is a generic message, because the detail can leak information about the payment
 * infrastructure and the customer cannot act on it anyway.
 *
 * Shared by the new-card form and the saved-card button, so both say the same thing about the
 * same failure.
 */
export function customerSafeMessage(error: StripeError): string {
  return error.type === 'card_error' || error.type === 'validation_error'
    ? (error.message ?? 'Your card was declined.')
    : 'Something went wrong taking the payment. Please try again.';
}
