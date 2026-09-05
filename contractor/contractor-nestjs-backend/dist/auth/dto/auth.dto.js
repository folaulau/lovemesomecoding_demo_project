var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../common/enums.js';
export class RegisterDto {
    email;
    password;
    firstName;
    lastName;
    phone;
    role;
}
__decorate([
    IsEmail({}, { message: 'Enter a valid email address.' }),
    MaxLength(255),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    IsString(),
    MinLength(8, { message: 'Use a password of at least 8 characters.' }),
    MaxLength(72, { message: 'Passwords are limited to 72 characters.' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
__decorate([
    IsString(),
    Length(1, 80),
    __metadata("design:type", String)
], RegisterDto.prototype, "firstName", void 0);
__decorate([
    IsString(),
    Length(1, 80),
    __metadata("design:type", String)
], RegisterDto.prototype, "lastName", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(40),
    __metadata("design:type", String)
], RegisterDto.prototype, "phone", void 0);
__decorate([
    IsIn([UserRole.HOMEOWNER, UserRole.CONTRACTOR], {
        message: 'Pick whether you are a homeowner or a contractor.',
    }),
    __metadata("design:type", Object)
], RegisterDto.prototype, "role", void 0);
export class LoginDto {
    email;
    password;
}
__decorate([
    IsEmail({}, { message: 'Enter a valid email address.' }),
    __metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
//# sourceMappingURL=auth.dto.js.map