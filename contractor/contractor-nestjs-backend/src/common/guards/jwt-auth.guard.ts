import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

import { HASURA_CLAIMS_NAMESPACE } from '../../auth/jwt-payload.js'
import type { AuthenticatedUser, JwtPayload } from '../../auth/jwt-payload.js'

/**
 * Verifies the bearer token and puts the caller on the request.
 *
 * Written by hand rather than with `@nestjs/passport` + `passport-jwt`. Both are fine; this is the
 * path the Nest documentation takes first, it is about thirty lines, and every one of them is
 * visible — which for a tutorial repo beats a strategy class whose real work happens in a library.
 *
 * ⚠️ `jwtService.verifyAsync`, never `decode`. `decode` parses the token WITHOUT checking the
 * signature, so anyone can hand-write `{"role":"admin"}`, base64 it, and be an admin. It exists
 * for reading a token you have already verified, and it is the single most dangerous method in the
 * library.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const token = extractBearerToken(request)

    if (!token) {
      throw new UnauthorizedException('Sign in to do that.')
    }

    try {
      // The secret comes from JwtModule's registration — one place, so the signer and the verifier
      // cannot drift apart.
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token)
      const claims = payload[HASURA_CLAIMS_NAMESPACE]

      request.user = {
        id: claims['x-hasura-user-id'],
        publicId: payload.sub,
        email: payload.email,
        role: payload.role,
        contractorId: claims['x-hasura-contractor-id'],
      }
      return true
    } catch {
      // ⚠️ One message for expired, malformed and forged. Telling a caller WHICH of those went
      // wrong hands an attacker a free oracle for probing the token format, and tells an honest
      // user nothing they can act on beyond "sign in again".
      throw new UnauthorizedException('Your session has expired. Sign in again.')
    }
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization
  if (!header) return null

  // Split on whitespace rather than `startsWith('Bearer ')`: the scheme is case-insensitive per
  // RFC 6750 and clients send "bearer" often enough to matter.
  const [scheme, token] = header.split(' ')
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null
  return token.trim()
}
