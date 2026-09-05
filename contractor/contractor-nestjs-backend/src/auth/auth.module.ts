import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'

import type { AppConfig } from '../config/configuration.js'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js'
import { RolesGuard } from '../common/guards/roles.guard.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

/**
 * ⚠️ `@Global()`, and this is the one place in the app where that is the right call.
 *
 * Every feature module uses `JwtAuthGuard`, and a guard can only be constructed if `JwtService` is
 * available in the module that declares it. Without `@Global` every one of the six feature modules
 * would have to import `AuthModule` — six imports that exist purely to satisfy the DI container.
 * Making auth ambient is the same decision Nest's own docs describe for a cross-cutting concern.
 */
@Global()
@Module({
  imports: [
    // `registerAsync` rather than `register`: the secret comes from config, and config is itself
    // injected. The synchronous form would have to read `process.env` directly and would lose the
    // single typed definition in configuration.ts.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => {
        const jwt = config.getOrThrow<AppConfig['jwt']>('jwt')
        return {
          secret: jwt.secret,
          // ⚠️ HS256 explicitly, and it must match what Hasura is configured with in
          // docker-compose.yml. Leaving the algorithm implicit works right up until the two ends
          // disagree, and then every GraphQL request fails signature verification.
          // ⚠️ The cast is not laziness. `jsonwebtoken` types `expiresIn` as the `ms` package's
          // `StringValue` — a template literal union of every valid duration (`'7d'`, `'2 hours'`,
          // …) — and a value read from the environment is a plain `string`, which TypeScript
          // cannot narrow to that union. The alternative is to hand-write the union in
          // configuration.ts, which would then drift from whatever `ms` accepts. A bad duration is
          // caught at startup by jsonwebtoken itself, loudly.
          signOptions: {
            algorithm: 'HS256',
            expiresIn: jwt.expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
          verifyOptions: { algorithms: ['HS256'] },
        }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  // JwtModule is re-exported so the guards constructed in other modules can inject JwtService.
  exports: [AuthService, JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
