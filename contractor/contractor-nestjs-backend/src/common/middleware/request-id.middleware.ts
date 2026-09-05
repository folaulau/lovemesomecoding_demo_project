import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import type { NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

/**
 * Gives every request an id, and puts it on the response.
 *
 * ⚠️ This is MIDDLEWARE rather than an interceptor, and the difference is the whole reason the
 * file exists.
 *
 * Nest runs middleware BEFORE guards. An interceptor's work happens around the route handler, and
 * a request rejected by `JwtAuthGuard` never reaches a handler — so an interceptor doing this job
 * would stamp an id on every 200 and on no 401. The requests you most want to correlate in a log
 * are exactly the ones that failed, which makes "before the guards" not a detail but the
 * requirement.
 *
 * Middleware also pays for that position: it gets the raw Express `req`/`res` and no
 * `ExecutionContext`, so it cannot see which handler is about to run or what it returned. That is
 * the trade, and it is the right way round here — this needs the response, not the route.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const id = incomingId(req) ?? randomUUID()
    req.requestId = id
    // Set on the way IN, not on the way out. A handler that throws still has to answer with the
    // id, and by the time the exception filter runs the header is already there.
    res.setHeader('x-request-id', id)
    next()
  }
}

/**
 * An `x-request-id` the caller supplied, if it is one this app is willing to repeat.
 *
 * ⚠️ Accepting the client's value is what makes a trace span a proxy and the API — and it is also
 * a string from a stranger that is about to be written to a log file. An unfiltered value can
 * carry newlines, which forge whole log lines, or a few kilobytes of padding on every request.
 * So the charset is restricted and the length is capped, and anything else is replaced rather
 * than rejected: a malformed trace header is not worth failing a request over.
 */
function incomingId(req: Request): string | null {
  const header = req.headers['x-request-id']
  // Express gives an array when a header arrives more than once. Two ids are no id.
  if (typeof header !== 'string') return null

  const trimmed = header.trim()
  if (trimmed.length === 0 || trimmed.length > 64) return null
  return /^[A-Za-z0-9._-]+$/.test(trimmed) ? trimmed : null
}

/** The request, once this middleware has run. */
export type RequestWithId = Request & { requestId?: string }

/** Reads the id back out. Returns `'-'` rather than `undefined` so log lines stay one shape. */
export function requestIdOf(req: RequestWithId): string {
  return req.requestId ?? '-'
}
