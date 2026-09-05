import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { TrimPipe } from './common/pipes/trim.pipe.js';
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const config = app.get((ConfigService));
    app.useGlobalPipes(new TrimPipe(), new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: false,
        },
    }));
    app.enableCors({
        origin: config.getOrThrow('corsOrigins'),
        credentials: true,
    });
    const uploads = config.getOrThrow('uploads');
    app.useStaticAssets(resolve(process.cwd(), uploads.directory), { prefix: '/uploads/' });
    const port = config.getOrThrow('port');
    await app.listen(port);
    console.log(`Contractor API listening on http://localhost:${port}`);
}
await bootstrap();
//# sourceMappingURL=main.js.map