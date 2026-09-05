import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { QueryFailedError } from 'typeorm'

import { requestIdOf } from '../middleware/request-id.middleware.js'
import type { RequestWithId } from '../middleware/request-id.middleware.js'

/** Postgres' unique-constraint code. Named in `QuotesService` too, for the one case that service
 *  catches itself; this filter is the backstop for every constraint nobody thought to catch. */
const PG_UNIQUE_VIOLATION = '23505'
/** A row referencing something that is not there, or being deleted while something references it. */
const PG_FOREIGN_KEY_VIOLATION = '23503'

/**
 * The last thing that runs. Turns anything thrown anywhere into one response shape.
 *
 * ⚠️ `@Catch()` with NO argument means "every exception", including the ones that are not
 * `HttpException` — which is the entire point. Nest's built-in filter already handles
 * `HttpException` perfectly well; what it does with a `QueryFailedError` is turn it into a bare
 * 500, and what it does with a `TypeError` is the same. Those are the cases worth owning.
 *
 * ⚠️ This filter ADDS to Nest's body rather than replacing it. `message` keeps the exact shape
 * Nest produced — a string for `new ConflictException('…')`, an ARRAY of strings for a
 * `ValidationPipe` rejection — because that shape is what every client already reads, and the e2e
 * suite asserts on both forms. A filter that "tidies" `message` into a single string is a breaking
 * API change wearing a refactor's clothes.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions')

  catch(exception: unknown, host: ArgumentsHost): void {
    // ⚠️ Same guard as the logging interceptor: bound globally, this filter would also be handed
    // exceptions from a non-HTTP transport, where `getResponse()` is not an Express response.
    if (host.getType() !== 'http') throw exception

    const http = host.switchToHttp()
    const response = http.getResponse<Response>()
    const request = http.getRequest<RequestWithId>()

    const { status, body } = describe(exception)

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // ⚠️ The stack goes to the LOG and never into the body. A stack trace in a response names
      // file paths, library versions and sometimes the query that failed — a free map of the
      // server for anyone who can make it throw.
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status} req=${requestIdOf(request)}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    response.status(status).json({
      ...body,
      statusCode: status,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      // The value `RequestIdMiddleware` put on the request and on the response header, so a user
      // reporting "it said something went wrong" is holding the key to their own log line.
      requestId: requestIdOf(request),
    })
  }
}

/** What to answer with, for each kind of thing that can be thrown. */
function describe(exception: unknown): { status: number; body: Record<string, unknown> } {
  if (exception instanceof HttpException) {
    const payload = exception.getResponse()
    return {
      status: exception.getStatus(),
      // `getResponse()` is an object for every built-in exception, and a plain string when
      // somebody constructs `new HttpException('nope', 400)` by hand. Both happen.
      body: typeof payload === 'string' ? { message: payload } : { ...(payload as object) },
    }
  }

  if (exception instanceof QueryFailedError) {
    const code = (exception.driverError as { code?: string } | undefined)?.code

    /**
     * ⚠️ A unique violation is a 409, not a 500. It means two requests raced and the database
     * settled it — the losing caller did nothing wrong and retrying may well work, which is
     * precisely what 409 says and what 500 does not.
     *
     * The messages are deliberately generic. A constraint name is a schema detail, and
     * `uq_one_accepted_quote_per_project` in a response body tells a stranger the table layout.
     * Where a specific message is worth having, the service catches the error itself and says
     * something useful — `QuotesService` does exactly that for "you have already quoted".
     */
    if (code === PG_UNIQUE_VIOLATION) {
      return {
        status: HttpStatus.CONFLICT,
        body: { message: 'That has already been done.', error: 'Conflict' },
      }
    }
    if (code === PG_FOREIGN_KEY_VIOLATION) {
      return {
        status: HttpStatus.CONFLICT,
        body: { message: 'Something this refers to is missing or still in use.', error: 'Conflict' },
      }
    }

    // Any other query failure is a bug in a query, which is ours and not the caller's.
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: GENERIC_500 }
  }

  // ⚠️ A `TypeError`, a failed `JSON.parse`, anything at all. The message is NOT forwarded:
  // `Cannot read properties of undefined (reading 'contractorId')` is a defect report, and it
  // belongs in the log this filter already wrote, not in a response.
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: GENERIC_500 }
}

const GENERIC_500 = {
  message: 'Something went wrong. Try again.',
  error: 'Internal Server Error',
} as const
