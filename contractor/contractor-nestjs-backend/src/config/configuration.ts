/**
 * Every environment variable this app reads, in one typed object.
 *
 * The alternative — `process.env.WHATEVER` scattered through the code — has three problems this
 * fixes: a typo in a variable name is `undefined` rather than a compile error, there is no single
 * place to see what the app needs to run, and every value is a string until somebody remembers to
 * parse it.
 */

/** Reads a variable, falling back to a default. Blank counts as absent — an empty `.env` line
 *  (`CONTRACTOR_DB_HOST=`) should behave like not setting it, not like setting it to "". */
function env(name: string, fallback: string): string {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? fallback : value
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw)
  // Failing loudly beats silently falling back. A typo'd port that quietly becomes the default is
  // a confusing half hour; a startup error naming the variable is thirty seconds.
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer, got "${raw}"`)
  }
  return parsed
}

export interface AppConfig {
  port: number
  database: {
    host: string
    port: number
    username: string
    password: string
    database: string
  }
  jwt: {
    secret: string
    expiresIn: string
  }
  uploads: {
    directory: string
    maxBytes: number
  }
  corsOrigins: string[]
}

export function loadConfig(): AppConfig {
  return {
    // 3000 is free today but is the first port every other dev tool grabs, so this app claims 3001.
    port: envInt('CONTRACTOR_PORT', 3001),

    database: {
      // ⚠️ 5434 on the HOST. Inside the compose network Postgres is on 5432 — the shift is a
      // published-port mapping only. Using the host port from inside a container is a classic and
      // confusing failure; see the note in docker-compose.yml.
      host: env('CONTRACTOR_DB_HOST', 'localhost'),
      port: envInt('CONTRACTOR_DB_PORT', 5434),
      username: env('CONTRACTOR_DB_USER', 'contractor'),
      password: env('CONTRACTOR_DB_PASSWORD', 'contractor'),
      database: env('CONTRACTOR_DB_NAME', 'contractor'),
    },

    jwt: {
      /**
       * ⚠️ This value MUST match `HASURA_GRAPHQL_JWT_SECRET.key` in docker-compose.yml exactly.
       * NestJS signs; Hasura verifies with the same HS256 secret. A mismatch does not fail at
       * startup — every GraphQL request just returns "Could not verify JWT: JWSInvalidSignature",
       * which reads like a client bug and is not.
       *
       * A shared symmetric secret means anyone holding it can mint a token claiming any role. That
       * is acceptable for a local demo and wrong in production, where this becomes RS256 and
       * Hasura is given only the public half.
       */
      secret: env('CONTRACTOR_JWT_SECRET', 'contractor-dev-jwt-secret-change-me-in-production-0123456789'),
      expiresIn: env('CONTRACTOR_JWT_EXPIRES_IN', '7d'),
    },

    uploads: {
      directory: env('CONTRACTOR_UPLOAD_DIR', 'uploads'),
      maxBytes: envInt('CONTRACTOR_UPLOAD_MAX_BYTES', 5 * 1024 * 1024),
    },

    /**
     * ⚠️ An explicit allowlist, never `origin: true`.
     *
     * Reflecting whatever `Origin` the request carried, combined with `credentials: true`, means
     * any site the user visits can call this API as them. The Vite dev server is on 5177 and
     * `strictPort` keeps it there — if it ever moved, the symptom would be a blank page and a CORS
     * error rather than anything that names the port.
     */
    corsOrigins: env('CONTRACTOR_CORS_ORIGINS', 'http://localhost:5177')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  }
}
