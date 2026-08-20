"""Stripe payments for a booking.

⚠️ Card numbers, CVCs and cardholder names NEVER reach this server. The browser sends them
straight to Stripe with the publishable key; we only ever see an opaque `pi_…` id and display
metadata (brand, last four). If a card number appears anywhere in this file, something is wrong.
"""

import logging
from decimal import Decimal

import stripe
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ApiException, NotFoundException
from app.models.booking import Booking, Payment
from app.models.enums import BookingStatus, PaymentStatus
from app.repositories.booking_repository import BookingRepository, PaymentRepository
from app.schemas.payment import PaymentIntentResponse

logger = logging.getLogger(__name__)


class PaymentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.payments = PaymentRepository(db)
        self.bookings = BookingRepository(db)
        if settings.stripe_secret_key:
            stripe.api_key = settings.stripe_secret_key

    def create_intent(self, booking: Booking, publishable_key: str) -> PaymentIntentResponse:
        if not settings.stripe_secret_key:
            raise ApiException(
                "Payments are not configured — set STAYHUB_STRIPE_SECRET_KEY in the backend .env."
            )
        if booking.status == BookingStatus.CONFIRMED:
            raise ApiException("This booking is already paid.")
        if booking.status == BookingStatus.CANCELLED:
            raise ApiException("This booking was cancelled.")

        # ⚠️ The amount comes from the BOOKING row, which the server computed. It is never taken
        # from the request. This is the last line of defence for the price.
        amount_cents = int((Decimal(booking.total) * 100).to_integral_value())

        existing = self.payments.latest_for_booking(booking.id)
        if existing and existing.status == PaymentStatus.REQUIRES_PAYMENT:
            # Reuse the open intent rather than creating a second one. A guest who reloads the
            # checkout page would otherwise leave a trail of abandoned PaymentIntents, and two live
            # intents for one booking is how a double charge happens.
            intent = stripe.PaymentIntent.retrieve(existing.stripe_payment_intent_id)
            if intent.status not in ("canceled", "succeeded"):
                return PaymentIntentResponse(
                    client_secret=intent.client_secret,
                    payment_intent_id=intent.id,
                    amount=booking.total,
                    currency=existing.currency,
                    publishable_key=publishable_key,
                )

        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            # Metadata is how the webhook finds its way back to our row. The webhook arrives from
            # Stripe with no session and no auth context; without this it would have nothing to
            # correlate on.
            metadata={
                "booking_public_id": str(booking.public_id),
                "property_id": str(booking.property_id),
            },
            automatic_payment_methods={"enabled": True},
            # Stripe deduplicates on this key, so a retried request cannot create a second intent
            # for the same booking.
            idempotency_key=f"booking-{booking.public_id}-{amount_cents}",
        )

        payment = Payment(
            booking_id=booking.id,
            stripe_payment_intent_id=intent.id,
            amount=booking.total,
            currency="usd",
            status=PaymentStatus.REQUIRES_PAYMENT,
        )
        self.payments.add(payment)
        self.db.commit()

        return PaymentIntentResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount=booking.total,
            currency="usd",
            publishable_key=publishable_key,
        )

    def handle_webhook(self, payload: bytes, signature: str) -> str:
        """Process a Stripe event.

        ⚠️ The signature check is not optional and not a formality. This endpoint is public and
        unauthenticated by necessity — Stripe has no token of ours. Without verification, anyone
        who can reach the URL can POST `payment_intent.succeeded` and confirm a booking they never
        paid for.
        """
        if not settings.stripe_webhook_secret:
            raise ApiException("Webhook secret is not configured.")

        try:
            event = stripe.Webhook.construct_event(
                payload, signature, settings.stripe_webhook_secret
            )
        except ValueError as exc:
            raise ApiException("Malformed webhook payload.") from exc
        except stripe.SignatureVerificationError as exc:
            raise ApiException("Webhook signature verification failed.") from exc

        intent = event["data"]["object"]

        if event["type"] == "payment_intent.succeeded":
            self._mark_succeeded(intent)
        elif event["type"] == "payment_intent.payment_failed":
            self._mark_failed(intent)
        # Every other event type is acknowledged and ignored. Returning a non-2xx makes Stripe
        # retry it, forever, for an event we were never going to act on.

        return event["type"]

    def _mark_succeeded(self, intent: dict) -> None:
        payment = self.payments.get_by_intent_id(intent["id"])
        if payment is None:
            # Not an error worth failing on: it can be an intent from another environment sharing
            # the same Stripe test account. Log it and acknowledge, or Stripe retries for days.
            logger.warning("Webhook for unknown payment intent %s", intent["id"])
            return

        # ⚠️ Idempotency. Stripe delivers at-least-once and WILL send the same event twice —
        # network retries, redeliveries from the dashboard. Every handler must be safe to run
        # again; this one returns early rather than double-confirming.
        if payment.status == PaymentStatus.SUCCEEDED:
            return

        payment.status = PaymentStatus.SUCCEEDED
        charges = (intent.get("charges") or {}).get("data") or []
        if charges:
            details = (charges[0].get("payment_method_details") or {}).get("card") or {}
            payment.card_brand = details.get("brand")
            payment.card_last4 = details.get("last4")

        booking = self.bookings.get(payment.booking_id)
        if booking and booking.status == BookingStatus.PENDING:
            booking.status = BookingStatus.CONFIRMED

        self.db.commit()

    def _mark_failed(self, intent: dict) -> None:
        payment = self.payments.get_by_intent_id(intent["id"])
        if payment is None:
            return
        payment.status = PaymentStatus.FAILED
        payment.failure_message = (intent.get("last_payment_error") or {}).get("message")
        # The booking stays PENDING, so the dates stay held and the guest can retry with another
        # card. A background job would expire stale PENDING bookings; that is out of scope here,
        # and worth saying out loud rather than pretending the gap does not exist.
        self.db.commit()

    def sync_from_stripe(self, booking: Booking) -> Payment | None:
        """Ask Stripe directly what happened, instead of waiting for the webhook.

        Webhooks need a public URL. On a laptop that means `stripe listen`, and without it a
        successful payment never confirms the booking. The confirmation page calls this so the
        local demo works either way — the webhook stays the authority in production.
        """
        payment = self.payments.latest_for_booking(booking.id)
        if payment is None or not settings.stripe_secret_key:
            return payment
        if payment.status == PaymentStatus.SUCCEEDED:
            return payment

        try:
            intent = stripe.PaymentIntent.retrieve(payment.stripe_payment_intent_id)
        except stripe.StripeError:
            logger.exception("Could not retrieve intent %s", payment.stripe_payment_intent_id)
            return payment

        if intent.status == "succeeded":
            self._mark_succeeded(dict(intent))
            self.db.refresh(payment)
        return payment
