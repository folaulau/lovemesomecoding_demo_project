from fastapi import APIRouter, Header, Request

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.exceptions import ApiException, NotFoundException
from app.repositories.booking_repository import BookingRepository
from app.schemas.common import Message
from app.schemas.payment import PaymentIntentRequest, PaymentIntentResponse, PaymentResponse
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/intent", response_model=PaymentIntentResponse)
def create_intent(
    payload: PaymentIntentRequest, user: CurrentUser, db: DbSession
) -> PaymentIntentResponse:
    """Start paying for a booking.

    Returns a `client_secret` the browser gives to Stripe.js. That secret authorises confirming
    this one PaymentIntent and nothing else — it is meant to reach the browser. The secret API key
    never does.
    """
    booking = BookingRepository(db).get_by_public_id_full(payload.booking_id)
    if booking is None or booking.guest_id != user.id:
        raise NotFoundException("Booking not found.")

    # ⚠️ NOT os.getenv. pydantic-settings parses .env into the Settings object and never touches
    # os.environ, so os.getenv returns "" for anything that lives only in the file. The failure is
    # quiet: the intent is created fine and the browser just gets an empty publishable key.
    return PaymentService(db).create_intent(booking, settings.stripe_publishable_key)


@router.get("/booking/{booking_public_id}", response_model=PaymentResponse)
def payment_status(booking_public_id, user: CurrentUser, db: DbSession) -> PaymentResponse:
    """The current payment state for a booking, asking Stripe directly if needed.

    The confirmation page polls this. Locally there is usually no webhook (that needs a public
    URL), so `sync_from_stripe` is what makes the demo work without running `stripe listen`.
    """
    booking = BookingRepository(db).get_by_public_id_full(booking_public_id)
    if booking is None or booking.guest_id != user.id:
        raise NotFoundException("Booking not found.")

    payment = PaymentService(db).sync_from_stripe(booking)
    if payment is None:
        raise NotFoundException("No payment has been started for this booking.")
    return PaymentResponse.model_validate(payment)


@router.post("/webhook", response_model=Message, include_in_schema=False)
async def stripe_webhook(
    request: Request,
    db: DbSession,
    stripe_signature: str = Header(default="", alias="Stripe-Signature"),
) -> Message:
    """Stripe calls this. Nobody else should be able to.

    ⚠️ Two things here are load-bearing:

    1. **The RAW body.** The signature is computed over the exact bytes Stripe sent. Reading a
       parsed dict and re-serialising it changes key order and whitespace, and verification then
       fails for reasons that look like a wrong secret. Hence `await request.body()`.
    2. **The signature check** (in PaymentService). This endpoint cannot require a token — Stripe
       has none of ours — so the signature IS the authentication. Skip it and anyone who finds the
       URL can POST "payment succeeded" and confirm a booking for free.
    """
    payload = await request.body()
    if not stripe_signature:
        raise ApiException("Missing Stripe-Signature header.", status_code=400)

    event_type = PaymentService(db).handle_webhook(payload, stripe_signature)
    return Message(message=f"Handled {event_type}")
