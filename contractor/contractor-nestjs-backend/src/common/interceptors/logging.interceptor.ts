import { Injectable, Logger } from '@nestjs/common'
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Response } from 'express'
import type { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

import type { AuthenticatedUser } from '../../auth/jwt-payload.js'
import { requestIdOf } from '../middleware/request-id.middleware.js'
import type { RequestWithId } from '../middleware/request-id.middleware.js'

/**
 * One log line per request, written when the request is finished.
 *
 * ⚠️ An INTERCEPTOR rather than middleware, and for the mirror image of the reason
 * `RequestIdMiddleware` is middleware. This needs to know how the request ENDED — the status, the
 * duration, and whether the handler threw. Middleware runs on the way in and has already handed
 * control onward by the time any of that exists; the only way it can log an outcome is to hook
 * `res.on('finish')` and lose the exception entirely.
 *
 * An interceptor wraps the handler in an Observable, so both outcomes are in reach:
 *
 *     next.handle().pipe(tap({ next: …, error: … }))
 *
 * ⚠️ `tap`, deliberately, and never `map`. `tap` observes the value and passes it through
 * untouched; `map` would make this interceptor part of the response, which is a lot of power for
 * something whose job is to write a line to stdout. An interceptor that logs should not be able to
 * change what the caller receives.
 *
 * ⚠️ It also sits INSIDE the guards. A 401 from `JwtAuthGuard` never reaches this interceptor and
 * so never gets a line here — which is exactly why the request id is set in middleware, one layer
 * further out, and why the exception filter logs the failures this cannot see.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // ⚠️ Guarded, because an interceptor bound globally runs for every transport. This app is
    // HTTP-only today, and `switchToHttp()` on a future WebSocket or microservice context returns
    // an object whose `getRequest()` is not an Express request at all.
    if (context.getType() !== 'http') return next.handle()

    const http = context.switchToHttp()
    const request = http.getRequest<RequestWithId & { user?: AuthenticatedUser }>()
    const response = http.getResponse<Response>()

    const startedAt = Date.now()
    // Read the route BEFORE the handler runs. `context.getHandler().name` is the method, which is
    // more useful in a log than the raw path when the path carries ids.
    const handler = `${context.getClass().name}.${context.getHandler().name}`

    const write = (status: number, error?: unknown) => {
      const line =
        `${request.method} ${request.originalUrl} ${status} ${Date.now() - startedAt}ms ` +
        `${handler} req=${requestIdOf(request)} user=${request.user?.publicId ?? 'anon'}`

      // A 4xx is the caller's problem and a normal thing for a working API to answer; a 5xx is
      // ours. Logging both at the same level is how the ones that matter get lost.
      if (status >= 500) this.logger.error(line, error instanceof Error ? error.stack : undefined)
      else if (status >= 400) this.logger.warn(line)
      else this.logger.log(line)
    }

    return next.handle().pipe(
      tap({
        next: () => write(response.statusCode),
        // ⚠️ `response.statusCode` is still 200 here — the exception filter has not run yet, so
        // nothing has set it. The status has to come off the exception itself.
        error: (error: unknown) => write(statusOf(error), error),
      }),
    )
  }
}

/** The status an exception is going to become, without depending on the filter having run. */
function statusOf(error: unknown): number {
  const status = (error as { getStatus?: () => number })?.getStatus
  return typeof status === 'function' ? status.call(error) : 500
}
