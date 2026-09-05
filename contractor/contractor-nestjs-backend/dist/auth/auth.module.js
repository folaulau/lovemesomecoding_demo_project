var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
let AuthModule = class AuthModule {
};
AuthModule = __decorate([
    Global(),
    Module({
        imports: [
            JwtModule.registerAsync({
                inject: [ConfigService],
                useFactory: (config) => {
                    const jwt = config.getOrThrow('jwt');
                    return {
                        secret: jwt.secret,
                        signOptions: {
                            algorithm: 'HS256',
                            expiresIn: jwt.expiresIn,
                        },
                        verifyOptions: { algorithms: ['HS256'] },
                    };
                },
            }),
        ],
        controllers: [AuthController],
        providers: [AuthService, JwtAuthGuard, RolesGuard],
        exports: [AuthService, JwtModule, JwtAuthGuard, RolesGuard],
    })
], AuthModule);
export { AuthModule };
//# sourceMappingURL=auth.module.js.map