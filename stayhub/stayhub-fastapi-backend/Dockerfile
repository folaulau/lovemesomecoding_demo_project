# StayHub API — multi-stage build.
#
# Two stages for one reason: compilers. `psycopg[binary]`, `bcrypt` and `cryptography` may need a
# toolchain to install, and a toolchain is ~350 MB that must not be in the shipped image. The
# builder installs into a virtualenv; the runtime copies that virtualenv and nothing else.

# ---------------------------------------------------------------- builder
FROM python:3.12-slim AS builder

# build-essential and libpq-dev are here and ONLY here. Nothing below this stage needs them.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# A virtualenv rather than the system site-packages, because a whole directory is trivial to
# COPY into the next stage while system packages are scattered.
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /build

# ⚠️ requirements.txt is copied ALONE, before the source. Docker caches per layer and invalidates
# every layer after the first changed one. Copying the app first means each source edit re-runs
# pip install — a minute of downloads for a one-line change. This ordering means dependencies are
# reinstalled only when requirements.txt itself changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------- runtime
FROM python:3.12-slim AS runtime

# libpq5 is the RUNTIME half of libpq-dev — the shared library psycopg loads, without the headers
# and compiler. curl is for the healthcheck below.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
COPY --from=builder $VIRTUAL_ENV $VIRTUAL_ENV

# ⚠️ PYTHONUNBUFFERED is not a nicety. Python buffers stdout when it is not a TTY — which is
# exactly the case in a container — so without this, logs appear in `docker logs` in delayed
# chunks, and a process that crashes loses whatever was still in the buffer. The symptom is
# "my container produces no logs", and it is entirely this.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# ⚠️ A non-root user. The default is root, and root in the container is root on the host kernel
# for anything that escapes. This costs one line.
RUN useradd --create-home --shell /bin/bash --uid 1000 stayhub
WORKDIR /app

COPY --chown=stayhub:stayhub alembic.ini pytest.ini ./
COPY --chown=stayhub:stayhub alembic ./alembic
COPY --chown=stayhub:stayhub app ./app
COPY --chown=stayhub:stayhub scripts ./scripts

# Written to at runtime, so they must exist and be owned by the app user — a non-root process
# cannot mkdir inside a root-owned WORKDIR.
RUN mkdir -p uploads notifications && chown -R stayhub:stayhub uploads notifications

USER stayhub

# JSON logs in a container: something is collecting them, and a regex over prose is a worse
# contract than an object with fields.
ENV STAYHUB_LOG_JSON=true

EXPOSE 8000

# The health check the orchestrator restarts on. It reports database and elasticsearch separately
# — see app/main.py — so "unhealthy" comes with a reason attached.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# ⚠️ --host 0.0.0.0, and this is THE container gotcha. Uvicorn's default is 127.0.0.1, which
# inside a container means the container's own loopback. The bind succeeds, the app logs that it
# is running, `docker ps` shows the port published — and every request from the host is refused.
# Nothing anywhere says why.
#
# --workers 4: these are separate PROCESSES, and they are what uses more than one CPU core, since
# a single uvicorn process is one event loop on one core no matter how async the code is. Four is
# a starting point for a 2-4 core container; tune it against real traffic, and remember each
# worker carries its OWN SQLAlchemy connection pool — 4 workers × pool_size 5 is 20 connections to
# Postgres, which must be under max_connections.
#
# No --reload. It watches the filesystem and costs CPU forever in exchange for nothing here.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
