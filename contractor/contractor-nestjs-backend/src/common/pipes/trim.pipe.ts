import { Injectable } from '@nestjs/common'
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common'

/**
 * Trims every string in a request body, before anything validates it.
 *
 * ⚠️ This pipe exists because of a real bug, and the bug is worth understanding because every DTO
 * in this app had it.
 *
 * `RegisterDto` says `@Length(1, 80) firstName`, and `AuthService` then stores
 * `dto.firstName.trim()`. Send three spaces: `class-validator` counts three characters, passes it,
 * and the service writes an empty string. The validation was real, the trim was real, and between
 * them they let through exactly the value both were meant to stop — because they disagreed about
 * what the value WAS. The same applies to `@Length(5, 160)` on a project title and to every other
 * length rule here.
 *
 * Trimming first makes the string the validator sees the same string the service will store, and
 * the whole class of disagreement goes away.
 *
 * ⚠️ ORDER IS THE ENTIRE POINT. In `main.ts`:
 *
 *     app.useGlobalPipes(new TrimPipe(), new ValidationPipe({ … }))
 *
 * Nest runs global pipes left to right, so this one hands a trimmed body to `ValidationPipe`.
 * Reversed, the DTO is validated untrimmed and this would be trimming a value that has already
 * been judged — which is the bug again, with more steps.
 */
@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    /**
     * ⚠️ Bodies only.
     *
     * A global pipe is handed params and query strings as well, and trimming those is not
     * harmless: a route param is part of a URL the client constructed, and quietly making
     * `/projects/%20abc/status` mean `/projects/abc/status` hides a client bug rather than
     * surfacing it as the 400 that `ParseUUIDPipe` would otherwise give.
     */
    if (metadata.type !== 'body') return value
    return trim(value, 0)
  }
}

/** Nesting deeper than this is not a request body, it is an attack on the parser. */
const MAX_DEPTH = 8

function trim(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return value.trim()
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') return value

  if (Array.isArray(value)) return value.map((item) => trim(item, depth + 1))

  /**
   * ⚠️ Plain objects ONLY. `Object.getPrototypeOf` is checked rather than trusting `typeof`,
   * because a `Date`, a `Buffer` and a class instance are all `'object'` — and rebuilding one of
   * those field by field would quietly turn it into something else. Anything that is not a
   * `{}` is handed back untouched.
   */
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    result[key] = trim(item, depth + 1)
  }
  return result
}
