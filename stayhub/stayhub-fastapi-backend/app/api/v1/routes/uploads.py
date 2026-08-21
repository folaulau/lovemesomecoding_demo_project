"""Listing photo upload.

Files are stored on local disk, which is the one thing here a production deployment would change:
disk does not survive a container restart and is not shared between replicas, so real storage is
S3 (or equivalent) and this module becomes a `put_object` call plus a CDN URL. Everything else —
the size limit, the content sniffing, the generated filename — carries over unchanged.
"""

import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile

from app.core.config import settings
from app.core.deps import DbSession, HostUser
from app.core.exceptions import ApiException, NotFoundException
from app.repositories.property_repository import PropertyRepository
from app.schemas.common import ApiModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Allow-list, not a block-list. A block-list is a promise to have thought of every dangerous type,
# which nobody can keep.
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

# The first bytes each format actually starts with. See _sniff.
MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
}

CHUNK = 1024 * 1024  # 1 MiB


class UploadResponse(ApiModel):
    url: str
    filename: str
    content_type: str
    size_bytes: int


def _sniff(head: bytes) -> str | None:
    """Identify the format from the file's own first bytes.

    ⚠️ `UploadFile.content_type` is just the Content-Type the CLIENT put in the multipart part.
    It is not detected, not validated, and trivially forged — `curl -F 'file=@shell.php;
    type=image/png'` sets it to whatever you like. Checking only that header is the same as not
    checking.

    WebP is not here because its magic is a RIFF container ("RIFF"…"WEBP" at offset 8) rather than
    a fixed prefix; it is handled separately below.
    """
    for magic, mime in MAGIC.items():
        if head.startswith(magic):
            return mime
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.post("/property-image/{public_id}", response_model=UploadResponse)
async def upload_property_image(
    public_id: uuid.UUID,
    host: HostUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> UploadResponse:
    """Upload one photo for a listing you own.

    ⚠️ `async def` here, unlike most routes in this app, because `UploadFile`'s read methods are
    async — awaiting them in a sync route is not possible, and reading `file.file` directly blocks
    the event loop for the length of the upload.
    """
    prop = PropertyRepository(db).get_by_public_id_full(public_id)
    # 404 rather than 403 for someone else's listing — the house rule for foreign-owned resources.
    if prop is None or prop.deleted or prop.host_id != host.id:
        raise NotFoundException("Listing not found.")

    if file.content_type not in ALLOWED_TYPES:
        raise ApiException(
            f"Upload a JPEG, PNG or WebP image. That file says it is {file.content_type!r}."
        )

    head = await file.read(32)
    sniffed = _sniff(head)
    if sniffed is None or sniffed != file.content_type:
        # Mismatch means either a renamed file or a deliberate attempt. Neither gets stored.
        raise ApiException("That file is not the image type it claims to be.")
    await file.seek(0)

    target_dir = Path(settings.upload_dir) / str(prop.public_id)
    target_dir.mkdir(parents=True, exist_ok=True)

    # ⚠️ The client's filename is NEVER used to build the path. `file.filename` is attacker
    # controlled and "../../app/main.py" is a valid string. A generated uuid plus an extension
    # taken from OUR allow-list means the path cannot be influenced at all.
    filename = f"{uuid.uuid4().hex}{ALLOWED_TYPES[file.content_type]}"
    target = target_dir / filename

    size = 0
    try:
        with target.open("wb") as out:
            # ⚠️ Streamed in chunks, NOT `await file.read()`. Reading the whole upload into memory
            # means one 2 GB request is 2 GB of RSS, and ten concurrent ones kill the process.
            # Starlette already spills large uploads to a temp file; this keeps it that way.
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                # Checked DURING the write, not before it. There is no trustworthy length to check
                # up front: Content-Length is a claim, and a chunked upload does not send one.
                if size > settings.max_upload_bytes:
                    raise ApiException(
                        f"That image is larger than "
                        f"{settings.max_upload_bytes // (1024 * 1024)} MB."
                    )
                out.write(chunk)
    except Exception:
        # Never leave a partial file behind — half an image is still bytes on a disk, and the next
        # request would serve it.
        target.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    logger.info(
        "Stored %s for listing %s", filename, prop.public_id,
        extra={"property_id": str(prop.public_id), "size_bytes": size},
    )

    return UploadResponse(
        url=f"/static/uploads/{prop.public_id}/{filename}",
        filename=filename,
        content_type=file.content_type,
        size_bytes=size,
    )


@router.delete("/property-image/{public_id}/{filename}", response_model=UploadResponse | None)
async def delete_property_image(
    public_id: uuid.UUID, filename: str, host: HostUser, db: DbSession
) -> None:
    """Remove an uploaded photo."""
    prop = PropertyRepository(db).get_by_public_id_full(public_id)
    if prop is None or prop.deleted or prop.host_id != host.id:
        raise NotFoundException("Listing not found.")

    # ⚠️ Path traversal guard. `filename` comes from the URL, so "..%2F..%2F.env" is a thing
    # someone will try. Resolving both sides and checking containment is the check that actually
    # holds; string-matching for ".." does not (encodings, symlinks, "....//").
    base = (Path(settings.upload_dir) / str(prop.public_id)).resolve()
    target = (base / filename).resolve()
    if not target.is_relative_to(base):
        raise NotFoundException("Image not found.")

    if not target.exists():
        raise NotFoundException("Image not found.")

    target.unlink()
    logger.info("Deleted %s from listing %s", filename, prop.public_id)


def mount_static(app) -> None:
    """Serve what was uploaded, so the demo can actually show a photo.

    ⚠️ In production a request for a static file should never reach Python. nginx, a CDN or S3
    serves these; uvicorn doing it burns a worker on a job the kernel does better. It is here so
    the demo runs with one command.
    """
    from fastapi.staticfiles import StaticFiles

    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    app.mount("/static/uploads", StaticFiles(directory=root), name="uploads")
