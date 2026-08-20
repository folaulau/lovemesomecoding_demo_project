from decimal import Decimal
from uuid import UUID

from app.schemas.common import ApiModel


class PaymentIntentRequest(ApiModel):
    booking_id: UUID


class PaymentIntentResponse(ApiModel):
    """What the browser needs to confirm a card, and nothing more.

    `client_secret` is safe to send to the browser — that is its entire purpose, and it only
    authorises confirming this one PaymentIntent. The secret API key never leaves the server.
    """

    client_secret: str
    payment_intent_id: str
    amount: Decimal
    currency: str
    publishable_key: str


class PaymentResponse(ApiModel):
    public_id: UUID
    status: str
    amount: Decimal
    currency: str
    card_brand: str | None = None
    card_last4: str | None = None
    failure_message: str | None = None
