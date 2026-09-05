import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator'

import { UserRole } from '../../common/enums.js'

/**
 * The request bodies for `/auth`.
 *
 * ⚠️ These decorators only run because `main.ts` installs a global `ValidationPipe`. Without it
 * they are inert documentation and every field arrives unchecked — which is a genuinely common
 * way to ship a Nest app that looks validated and is not.
 */

export class RegisterDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  email: string

  /**
   * ⚠️ A MAXIMUM as well as a minimum, and the maximum is not arbitrary.
   *
   * bcrypt truncates its input at 72 BYTES. Without a cap, two different long passwords that share
   * a 72-byte prefix are the same password as far as the hash is concerned. Some bcrypt builds
   * (including the one this project uses) now throw on longer input instead, which turns a silly
   * password into a 500. Rejecting it here makes it a clean 400.
   */
  @IsString()
  @MinLength(8, { message: 'Use a password of at least 8 characters.' })
  @MaxLength(72, { message: 'Passwords are limited to 72 characters.' })
  password: string

  @IsString()
  @Length(1, 80)
  firstName: string

  @IsString()
  @Length(1, 80)
  lastName: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  /**
   * ⚠️ `admin` is deliberately NOT in this list.
   *
   * The role is the one field in this DTO that grants power, so it is the one field an attacker
   * will try. Allowing only the two self-service roles here means the worst a crafted request can
   * do is create the account type the form already offers.
   */
  @IsIn([UserRole.HOMEOWNER, UserRole.CONTRACTOR], {
    message: 'Pick whether you are a homeowner or a contractor.',
  })
  role: typeof UserRole.HOMEOWNER | typeof UserRole.CONTRACTOR
}

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string

  // No length rules on login. A minimum here tells an attacker the password policy and, worse,
  // rejects accounts created before the policy changed.
  @IsString()
  password: string
}
