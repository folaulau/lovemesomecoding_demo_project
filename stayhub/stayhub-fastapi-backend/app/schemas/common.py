"""The base every request and response model inherits.

The one job here is the snake_case ↔ camelCase boundary. Python is snake_case, TypeScript is
camelCase, and neither should have to bend. Pydantic's alias generator does the translation at the
edge so that `price_per_night` in a service is `pricePerNight` in a JSON body, automatically and in
both directions.

Hasura is configured to do the same (`HASURA_GRAPHQL_DEFAULT_NAMING_CONVENTION: graphql-default`),
so the frontends see one consistent shape whichever API answered.
"""

from typing import Annotated, Generic, TypeVar

import email_validator
from fastapi import Depends, Query
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# ⚠️ `EmailStr` rejects `@stayhub.test` out of the box, with the baffling message "the part after
# the @-sign is a special-use or reserved name". It is right: RFC 6761 reserves `.test` precisely
# SO THAT it can never be a real domain — which is exactly why it is the correct TLD for demo
# accounts, and exactly why the validator refuses to let mail be sent to it.
#
# This flag says "these addresses are for testing, allow the reserved TLDs". A production service
# should NOT set it: there, an address at `.test` really is a mistake worth catching.
email_validator.TEST_ENVIRONMENT = True


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        # Accept BOTH spellings on input. Without this a request must use camelCase, which makes
        # every curl example and every test fixture read strangely.
        populate_by_name=True,
        # Lets a route return a SQLAlchemy object directly and have pydantic read its attributes.
        from_attributes=True,
    )


class Message(ApiModel):
    message: str


class ErrorBody(ApiModel):
    """Documents the shape produced by core/exceptions.py, so it shows up in Swagger."""

    message: str
    field_errors: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

T = TypeVar("T")


class PageParams(ApiModel):
    """`?page=2&pageSize=50`, validated once and reused everywhere.

    A dependency rather than three repeated `Query(...)` arguments per route. The bounds are the
    point: without `le=100` a client can ask for `pageSize=1000000` and page one becomes a full
    table scan serialised into memory — pagination that protects nothing.
    """

    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: int = Query(default=1, ge=1, description="1-based"),
    page_size: int = Query(default=20, ge=1, le=100, alias="pageSize"),
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


PageQuery = Annotated[PageParams, Depends(page_params)]


class Page(ApiModel, Generic[T]):
    """A page of results, plus what the caller needs to ask for the next one.

    ⚠️ Returning a bare `list[T]` is the mistake this exists to prevent. A list has nowhere to put
    the total, so the client cannot render "page 3 of 12" or even know whether to show a Next
    button — and by the time you discover that, the endpoint is public and changing its shape is a
    breaking change. `SearchResponse` predates this class and hand-rolls the same four fields.

    `Page[PropertyResponse]` produces a distinct schema in the OpenAPI document, so a generated
    client gets a real type rather than `any`.
    """

    items: list[T]
    total: int
    page: int
    page_size: int

    @property
    def pages(self) -> int:
        return (self.total + self.page_size - 1) // self.page_size if self.page_size else 0

    @classmethod
    def of(cls, items: list[T], total: int, params: PageParams) -> "Page[T]":
        return cls(items=items, total=total, page=params.page, page_size=params.page_size)
