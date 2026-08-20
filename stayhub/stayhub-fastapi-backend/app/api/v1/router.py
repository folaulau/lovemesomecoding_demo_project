"""Assembles the v1 API.

Versioning the prefix from day one is cheap; retrofitting it once clients exist is not.
"""

from fastapi import APIRouter

from app.api.v1.routes import admin, auth, bookings, payments, properties, search

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(properties.router)
api_router.include_router(bookings.router)
api_router.include_router(payments.router)
api_router.include_router(search.router)
api_router.include_router(admin.router)
