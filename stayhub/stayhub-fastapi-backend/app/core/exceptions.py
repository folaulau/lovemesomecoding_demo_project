"""One error shape for the whole API, and the handlers that produce it.

Every failure — ours, FastAPI's validation, or an unhandled crash — leaves as the same JSON body,
so the frontends need exactly one error parser.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class ApiException(Exception):
    """Raised anywhere in the service layer; turned into a response by the handler below."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        field_errors: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.field_errors = field_errors or {}


class NotFoundException(ApiException):
    def __init__(self, message: str = "Not found") -> None:
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class ConflictException(ApiException):
    """The request was well formed but the world says no — e.g. those dates are taken."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=status.HTTP_409_CONFLICT)


class UnauthorizedException(ApiException):
    def __init__(self, message: str = "Not authenticated") -> None:
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenException(ApiException):
    def __init__(self, message: str = "Not allowed") -> None:
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)


def _body(message: str, field_errors: dict[str, str] | None = None) -> dict:
    return {"message": message, "fieldErrors": field_errors or {}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiException)
    async def _api_exception(_: Request, exc: ApiException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content=_body(exc.message, exc.field_errors)
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Flatten pydantic's nested location tuples into "field -> message", which is what a form
        # can actually render next to an input.
        fields: dict[str, str] = {}
        for err in exc.errors():
            location = [part for part in err["loc"] if part not in ("body", "query", "path")]
            fields[".".join(str(p) for p in location) or "_"] = err["msg"]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_body("Please check the highlighted fields.", fields),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # Log the real reason, return a generic one. A stack trace in a response body is a gift
        # to whoever is probing the API.
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_body("Something went wrong on our end."),
        )
