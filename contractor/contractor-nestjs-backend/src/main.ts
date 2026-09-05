import { resolve } from 'node:path'

import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'

import { AppModule } from './app.module.js'
import { TrimPipe } from './common/pipes/trim.pipe.js'
import type { AppConfig } from './config/configuration.js'

async function bootstrap() {
  // Typed as NestExpressApplication so `useStaticAssets` exists. The default `INestApplication`
  // is platform-agnostic and does not have it.
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get(ConfigService<AppConfig>)

  /**
   * ⚠️ Without this pipe, every `class-validator` decorator in every DTO is inert. They are
   * metadata; the pipe is what reads it. An app with beautifully annotated DTOs and no global
   * pipe is completely unvalidated, and nothing about it looks wrong.
   */
  app.useGlobalPipes(
    /**
     * ⚠️ BEFORE the ValidationPipe, and the order is load-bearing. Nest runs global pipes left to
     * right, so this hands a trimmed body to the validator — which is what makes `@Length(1, 80)`
     * reject three spaces instead of passing them and letting the service store `""`.
     * See trim.pipe.ts.
     */
    new TrimPipe(),
    new ValidationPipe({
      // Strips properties with no decorator. A request carrying `{"role":"admin"}` at a DTO that
      // has no `role` field arrives at the service without it.
      whitelist: true,
      // ...and rejects the request outright rather than silently dropping the field. Louder, and
      // it turns "why was my field ignored" into an error that names the field.
      forbidNonWhitelisted: true,
      // Runs class-transformer, which is what makes `@Type(() => Number)` work.
      transform: true,
      transformOptions: {
        // Lets a form-encoded "1800" satisfy a `number` field. Only applies where `@Type` says so.
        enableImplicitConversion: false,
      },
    }),
  )

  /**
   * ⚠️ An explicit allowlist, never `origin: true`.
   *
   * Reflecting the request's own Origin means any site the user visits can call this API as them.
   * The list is one entry — the Vite dev server on 5177 — and `strictPort` in vite.config.ts is
   * what keeps it true.
   */
  app.enableCors({
    origin: config.getOrThrow<string[]>('corsOrigins'),
    credentials: true,
  })

  /**
   * Uploaded portfolio photos.
   *
   * ⚠️ Served as STATIC FILES from a directory that contains nothing but generated filenames with
   * known-good extensions (see `image-validation.ts`). Express's static handler does not execute
   * anything, so even a file that lied about its type is only ever sent, never run.
   */
  const uploads = config.getOrThrow<AppConfig['uploads']>('uploads')
  app.useStaticAssets(resolve(process.cwd(), uploads.directory), { prefix: '/uploads/' })

  const port = config.getOrThrow<number>('port')
  await app.listen(port)

  // eslint-disable-next-line no-console
  console.log(`Contractor API listening on http://localhost:${port}`)
}

await bootstrap()
