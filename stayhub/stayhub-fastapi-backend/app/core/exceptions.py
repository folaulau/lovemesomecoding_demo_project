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


# The generic 500. Deliberately a module-level function rather than something buried inside the
# handler below, because TWO places have to produce this exact response — see the ⚠️ in
# register_exception_handlers — and the frontends parse one error shape, not two.
UNHANDLED_MESSAGE = "Something went wrong on our end."


def unhandled_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=_body(UNHANDLED_MESSAGE)
    )


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
        """Backstop only. In practice RequestContextMiddleware gets there first.

        ⚠️ Starlette does NOT put a handler registered for bare `Exception` in the same place as
        the others. The specific handlers above live in ExceptionMiddleware, which is the
        INNERMOST layer — inside CORS, inside everything. A handler for `Exception` instead
        becomes ServerErrorMiddleware's handler, and that is the OUTERMOST layer of the whole
        stack.

        The consequence is not theoretical. A response built out there has already skipped every
        user middleware on the way back, so it carries no CORS headers — and a browser shown a
        500 with no `Access-Control-Allow-Origin` reports a CORS failure and never exposes the
        body. The frontend's error parser sees nothing at all.

        Measured on 2026-08-21, before the fix:

            unhandled 500 -> X-Request-ID absent, Access-Control-Allow-Origin absent
            handled   404 -> X-Request-ID present, Access-Control-Allow-Origin present

        So RequestContextMiddleware — which runs INSIDE CORS — catches unhandled exceptions and
        returns `unhandled_response()` itself. This stays registered for anything that escapes
        before that middleware is reached.
        """
        logger.exception("Unhandled error", exc_info=exc)
        return unhandled_response()
