"""The base every request and response model inherits.

The one job here is the snake_case ↔ camelCase boundary. Python is snake_case, TypeScript is
camelCase, and neither should have to bend. Pydantic's alias generator does the translation at the
edge so that `price_per_night` in a service is `pricePerNight` in a JSON body, automatically and in
both directions.

Hasura is configured to do the same (`HASURA_GRAPHQL_DEFAULT_NAMING_CONVENTION: graphql-default`),
so the frontends see one consistent shape whichever API answered.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


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
