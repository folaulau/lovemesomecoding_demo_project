import { useId, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { useStripe } from '@stripe/react-stripe-js';
import { ApiError } from '../lib/api';
import { cardLabel, isCardExpired } from '../lib/cards';
import { formatMoney } from '../lib/money';
import { orderApi } from '../lib/orderApi';
import { customerSafeMessage } from '../lib/stripeErrors';
import { StripePaymentForm } from './StripePaymentForm';
import type { PaymentMethod, UUID } from '../types';

interface Props {
  cards: PaymentMethod[];
  orderId: UUID;
  /** The order's PaymentIntent secret — the same one the new-card form confirms. */
  clientSecret: string;
  total: number;
  onSuccess: () => void;
  /** Asks the page to re-fetch the saved cards, after one turns out to be gone. */
  onCardsStale: () => void;
}

/** Sentinel for "type a new card" — the same trick CheckoutPage uses for "type a new address". */
const NEW_CARD = 'NEW';

/**
 * The card to start on: the primary if it can still be used, else the first card that can, else
 * a new card. The PO's rule — primary preselected, expired cards never selected.
 */
function defaultSelection(cards: PaymentMethod[]): string {
  const usable = cards.filter((c) => !isCardExpired(c));
  return (usable.find((c) => c.primary) ?? usable[0])?.id ?? NEW_CARD;
}

/**
 * Pay with a saved card — or fall back to typing a new one — on the checkout's payment step.
 *
 * Must render INSIDE the page's <Elements> provider: `useStripe` reads from it, and the new-card
 * branch is the ordinary StripePaymentForm, which needs it too. Both branches confirm the SAME
 * PaymentIntent, which is why a declined saved card can be followed by a new card on the same order.
 *
 * Paying with a saved card is two calls:
 *   1. our API puts the card on the PaymentIntent. We send OUR card id; the browser never holds
 *      the Stripe token, so it cannot leak one.
 *   2. Stripe.js confirms the intent with the clientSecret alone, using the card the server set.
 *      `confirmCardPayment` also runs 3D Secure in a modal if the bank asks for it.
 * The order is still only marked PAID by the server, exactly as for a new card.
 */
export function SavedCardPayment({
  cards,
  orderId,
  clientSecret,
  total,
  onSuccess,
  onCardsStale,
}: Props) {
  const stripe = useStripe();

  // useId: a radio group needs one shared `name`, unique on the page. A hard-coded string would
  // collide if this component were ever rendered twice; useId cannot.
  const groupName = useId();

  const [chosen, setChosen] = useState<string>(() => defaultSelection(cards));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * The selection actually in force, DERIVED rather than synced with an effect.
   *
   * After a reload the chosen card may have vanished (deleted in another tab). Copying props into
   * state with useEffect would render one frame with a stale selection; deriving it during render
   * cannot be stale at all.
   */
  const usableIds = new Set(cards.filter((c) => !isCardExpired(c)).map((c) => c.id));
  const selected = chosen === NEW_CARD || usableIds.has(chosen) ? chosen : defaultSelection(cards);
  const selectedCard = cards.find((c) => c.id === selected);

  async function payWithSavedCard() {
    // Null until Stripe.js has loaded; the button is disabled until then anyway.
    if (!stripe || !selectedCard) return;

    setSubmitting(true);
    setError(null);

    // ---- 1. our API: put the card on the PaymentIntent -----------------------------------------
    try {
      await orderApi.selectSavedCard(orderId, selectedCard.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Deleted since the list loaded. Refresh it; `selected` above then moves off it on its own.
        setError('That card is no longer available. Please choose another.');
        onCardsStale();
      } else {
        // Our server's messages are written for the customer ("That card has expired…").
        setError(
          err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.',
        );
      }
      setSubmitting(false);
      return;
    }

    // ---- 2. Stripe: confirm with the card the server set ---------------------------------------
    const result = await stripe.confirmCardPayment(clientSecret);

    if (result.error) {
      // A decline lands here. The chooser stays usable, so the customer can pick another card or
      // switch to a new one — the order and its PaymentIntent are unchanged.
      setError(customerSafeMessage(result.error));
      setSubmitting(false);
      return;
    }

    // Same contract as StripePaymentForm: Stripe accepted it, the server decides it is PAID.
    onSuccess();
  }

  return (
    <div>
      {/*
        A fieldset + legend, not a div: the legend is what gives the radio group its accessible
        name, so a screen reader announces "Pay with" on entering it. `fs-6` cancels the large
        font size Bootstrap's reboot gives every legend, so it looks the same as a label.
      */}
      <Form.Group as="fieldset" className="mb-3">
        <Form.Label as="legend" className="fw-semibold mb-2 fs-6">
          Pay with
        </Form.Label>

        {cards.map((card) => {
          const expired = isCardExpired(card);
          return (
            <Form.Check
              key={card.id}
              type="radio"
              name={groupName}
              id={`${groupName}-${card.id}`}
              checked={selected === card.id}
              // Shown but not selectable — the PO's rule for expired cards.
              disabled={expired || submitting}
              onChange={() => {
                setChosen(card.id);
                setError(null);
              }}
              label={
                <span>
                  <span className="fw-semibold">{cardLabel(card)}</span>{' '}
                  {card.primary && <Badge bg="success">primary</Badge>}{' '}
                  {expired && <Badge bg="secondary">Expired</Badge>}
                  {card.expMonth != null && card.expYear != null && (
                    <span className="d-block text-muted small">
                      Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                    </span>
                  )}
                </span>
              }
            />
          );
        })}

        <Form.Check
          type="radio"
          name={groupName}
          id={`${groupName}-new`}
          checked={selected === NEW_CARD}
          disabled={submitting}
          onChange={() => {
            setChosen(NEW_CARD);
            setError(null);
          }}
          label="Use a new card"
        />
      </Form.Group>

      {selected === NEW_CARD || !selectedCard ? (
        // The ordinary card form, unchanged. It confirms the same PaymentIntent, and the card it
        // collects replaces any saved card the server put there after a decline.
        <StripePaymentForm total={total} onSuccess={onSuccess} />
      ) : (
        <>
          {error && (
            <Alert variant="danger" className="mb-0">
              {error}
            </Alert>
          )}

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-100 mt-3"
            disabled={!stripe || submitting}
            onClick={payWithSavedCard}
          >
            {submitting ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Processing…
              </>
            ) : (
              `Pay ${formatMoney(total)} with ${cardLabel(selectedCard)}`
            )}
          </Button>
        </>
      )}
    </div>
  );
}
