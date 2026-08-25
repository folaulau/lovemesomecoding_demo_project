"""Assembles the v1 API.

Versioning the prefix from day one is cheap; retrofitting it once clients exist is not.
"""

from fastapi import APIRouter

from app.api.v1.routes import (
    admin,
    auth,
    bookings,
    oauth,
    payments,
    properties,
    search,
    uploads,
)

api_router = APIRouter()
api_router.include_router(auth.router)
# ⚠️ After auth.router, and it matters: this one's prefix is /auth/oauth, so a route here would
# be shadowed by a /auth/{something} path parameter if auth.router ever grew one.
api_router.include_router(oauth.router)
api_router.include_router(properties.router)
api_router.include_router(bookings.router)
api_router.include_router(payments.router)
api_router.include_router(search.router)
api_router.include_router(uploads.router)
api_router.include_router(admin.router)
