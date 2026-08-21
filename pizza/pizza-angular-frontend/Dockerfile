# The Angular frontend as a container image.
#
#   docker build -t pizza-web-angular .
#   docker run --rm -p 4200:8080 pizza-web-angular
#
# Same two-stage shape as the React image: Node to build, nginx to serve. What is
# different is configuration — see the ARG note below and nginx.conf.

# ------------------------------------------------------------------ stage 1: build
FROM node:22-alpine AS build

WORKDIR /app

# Dependency manifest first, install second, source last — so an ordinary code
# change reuses the cached `npm ci` layer instead of re-installing Angular.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ⚠️ `--configuration container`, not the default `production`.
#
# The React image takes a Docker build arg for this — `VITE_API_BASE_URL=""` —
# because Vite substitutes `import.meta.env.*` at build time. Angular has no
# equivalent: no `import.meta.env`, and no runtime environment mechanism at all.
# The CLI's answer is `fileReplacements`, so saying "use a relative API URL"
# takes an extra FILE (src/environments/environment.container.ts) and an extra
# build configuration in angular.json.
#
# Same outcome, three times the ceremony — and worth knowing before you plan a
# per-environment image strategy around one framework or the other.
#
# The `container` configuration inherits production's settings, so optimisation
# is on, every output filename is hashed, and the bundle budgets are enforced: a
# build that grows past the 1 MB initial budget FAILS here rather than shipping
# quietly. The `--` passes the flag through npm to `ng build`.
RUN npm run build -- --configuration container

# ------------------------------------------------------------------ stage 2: serve
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf

# ⚠️ The `/browser` on the end is load-bearing. Angular's application builder
# writes dist/<project>/browser/ for the client bundle and dist/<project>/server/
# for the server one if SSR is enabled. Copying dist/<project> instead puts
# index.html one directory below nginx's root, and every request returns 404 from
# a build that succeeded.
COPY --from=build /app/dist/pizza-angular-frontend/browser /usr/share/nginx/html

EXPOSE 8080
