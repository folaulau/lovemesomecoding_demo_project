# The React frontend as a container image.
#
#   docker build -t pizza-web .
#   docker run --rm -p 8080:8080 pizza-web
#
# Multi-stage, and the contrast between the two stages is the point: the build
# stage needs Node, npm and ~400 MB of node_modules; the result needs none of
# them. A built single-page app is static files, so the runtime is a web server.

# ------------------------------------------------------------------ stage 1: build
FROM node:22-alpine AS build

WORKDIR /app

# ⚠️ Where the API lives is baked in at BUILD time. Vite substitutes
# import.meta.env.* into the bundle during the build — there is no runtime
# lookup, so this cannot be changed with `docker run -e` afterwards. One image
# per environment, or a runtime-config file the app fetches on startup.
#
# The default is EMPTY on purpose, which makes the app request /api/... on its
# own origin and lets nginx.conf proxy it to the API container. Pass an absolute
# URL to talk to an API somewhere else:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com .
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# package.json and the lockfile first, `npm ci` second, source LAST. The install
# layer is then reused for every build where the dependencies did not change,
# which is nearly all of them. `COPY . .` before the install would re-download
# node_modules on every one-character edit.
COPY package.json package-lock.json ./

# `npm ci` rather than `npm install`: it installs exactly the lockfile, fails if
# package.json and the lockfile disagree, and never writes the lockfile back.
# That is what makes the build reproducible instead of merely repeatable.
RUN npm ci

COPY . .

RUN npm run build

# ------------------------------------------------------------------ stage 2: serve
# nginxinc/nginx-unprivileged, not the official nginx image. The official one
# starts as root to bind port 80 and then drops privileges for its workers; this
# one never runs as root at all.
#
# ⚠️ The trade is that it CANNOT listen on 80. Ports below 1024 are privileged,
# and a non-root process is refused — which is why nginx.conf says 8080. Publish
# it wherever you like on the host: `-p 80:8080` works fine, because the host
# side of a publish is bound by the Docker daemon, which is root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Replaces the image's default server block. `default.conf` is what the stock
# nginx.conf in this image includes; dropping a file here is the supported way to
# configure it without replacing the whole nginx.conf.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Only the built output crosses from the build stage. No node_modules, no source,
# no npm cache — the difference between a ~70 MB image and a ~500 MB one.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# The base image already sets USER nginx and a CMD that runs nginx in the
# foreground. Overriding either is how you accidentally end up back at root, or
# with a container that exits immediately because nginx daemonised itself.
