/**
 * Where the two backends live.
 *
 * ⚠️ Vite only exposes variables prefixed `VITE_` to the bundle, and that is a safety feature
 * rather than a naming quirk: without it, every secret in the shell that ran `npm run build` would
 * be a candidate for ending up in a JavaScript file served to the public. Nothing secret may live
 * in any of these values, because all three are readable by anyone who opens devtools.
 */

/** NestJS. Every create, update and delete goes here. */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/** Hasura. Every read goes here. */
export const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:8083/v1/graphql'

/**
 * Turns a stored image path into something the browser can load.
 *
 * Uploaded photos are stored as `/uploads/<uuid>.jpg` — a relative path, so that moving the API to
 * a real domain does not invalidate every row (see `portfolio-image.entity.ts`). Seeded photos are
 * `data:` URIs, which are already complete. This tells them apart.
 */
export function mediaUrl(url: string): string {
  if (url.startsWith('data:') || url.startsWith('http')) return url
  return `${API_URL}${url}`
}
