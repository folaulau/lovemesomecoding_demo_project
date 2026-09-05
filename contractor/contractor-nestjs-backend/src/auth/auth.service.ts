import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectDataSource } from '@nestjs/typeorm'
import bcrypt from 'bcrypt'
import { DataSource } from 'typeorm'

import { UserRole } from '../common/enums.js'
import { toUserDto } from '../common/serializers.js'
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import { User } from '../database/entities/user.entity.js'
import type { LoginDto, RegisterDto } from './dto/auth.dto.js'
import { HASURA_CLAIMS_NAMESPACE } from './jwt-payload.js'
import type { JwtPayload } from './jwt-payload.js'

/**
 * ⚠️ The bcrypt cost factor. 12 is roughly 250ms on a modern laptop — deliberately slow, because
 * the entire security of a password hash is that an attacker who steals the table cannot try
 * billions of guesses a second against it. Dropping this to speed up a test suite is the wrong
 * trade; tests should hash fewer passwords, not weaker ones.
 */
const BCRYPT_ROUNDS = 12

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Creates an account — and, for a contractor, their profile row in the SAME transaction.
   *
   * ⚠️ The transaction is the point. A contractor with a user row and no profile cannot sign in
   * usefully, cannot be found in the directory, and has no id for their quotes to hang off. Two
   * separate saves means a failure between them leaves exactly that account in the database, and
   * nothing will ever come back to fix it.
   */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase()

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(User, { where: { email } })
      // Registration is the ONE place that must admit an address is taken — there is no other way
      // to tell a new user why their sign-up failed. Login stays deliberately vague; this cannot.
      if (existing) {
        throw new ConflictException('An account with that email already exists.')
      }

      const user = manager.create(User, {
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
        // ⚠️ From the DTO, which permits only `homeowner` or `contractor`. There is no code path
        // anywhere in this app that creates an admin from a request.
        role: dto.role,
        avatarUrl: null,
        deleted: false,
      })
      await manager.save(user)

      let profile: ContractorProfile | null = null
      if (user.role === UserRole.CONTRACTOR) {
        profile = manager.create(ContractorProfile, {
          user,
          // Seeded with their own name so the profile is never nameless. They are sent straight to
          // the edit form after sign-up to replace it.
          businessName: `${user.firstName} ${user.lastName}`,
          bio: '',
          yearsInBusiness: 0,
          licenseNumber: null,
          city: '',
          state: '',
          zip: '',
          serviceRadiusMiles: 25,
          hourlyRateMin: 0,
          hourlyRateMax: 0,
          ratingAverage: 0,
          reviewCount: 0,
          deleted: false,
          categories: [],
        })
        await manager.save(profile)
      }

      return {
        token: await this.signToken(user, profile?.id),
        user: toUserDto(user),
      }
    })
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase()
    const user = await this.dataSource.getRepository(User).findOne({ where: { email } })

    /**
     * ⚠️ Three different failures, one message and one status code:
     *   - no account with that address
     *   - the account is soft-deleted
     *   - the password is wrong
     *
     * Distinguishing them turns the login form into an oracle that confirms which addresses are
     * registered, which is the first step of both credential stuffing and targeted phishing.
     */
    const invalid = new UnauthorizedException('That email and password do not match an account.')
    if (!user || user.deleted) {
      /**
       * ⚠️ A hash is compared even when there is no user, and the wasted ~250ms is the entire
       * point. Returning immediately makes "no such account" measurably faster than "wrong
       * password", and that timing difference is itself the oracle the shared message just closed.
       */
      await bcrypt.compare(dto.password, DUMMY_HASH)
      throw invalid
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash)
    if (!matches) throw invalid

    const profile =
      user.role === UserRole.CONTRACTOR
        ? await this.dataSource
            .getRepository(ContractorProfile)
            .findOne({ where: { userId: user.id } })
        : null

    return {
      token: await this.signToken(user, profile?.id),
      user: toUserDto(user),
    }
  }

  /**
   * Mints the token that BOTH APIs trust: NestJS verifies it in `JwtAuthGuard`, Hasura verifies it
   * with the same HS256 secret and reads the claims below to pick a permission set.
   */
  private async signToken(user: User, contractorProfileId?: string): Promise<string> {
    const payload: JwtPayload = {
      // The PUBLIC id. This token lives in the browser and anyone can base64-decode it, so it must
      // not carry the internal sequence... except that Hasura needs the internal id to compare
      // against foreign keys, which is why it appears in the claims below and not here. Neither
      // value is secret; `sub` is simply the one the rest of the app uses.
      sub: user.publicId,
      email: user.email,
      role: user.role,

      [HASURA_CLAIMS_NAMESPACE]: {
        // ⚠️ One role, not every role. Listing `['homeowner', 'contractor']` here would let the
        // holder pick either by sending an `x-hasura-role` header — Hasura trusts this list
        // completely, because verifying the signature is the only check it performs.
        'x-hasura-allowed-roles': [user.role],
        'x-hasura-default-role': user.role,
        // ⚠️ Strings, always. Hasura substitutes session variables as text; a JSON number produces
        // an error inside a permission rule that never mentions the real cause.
        'x-hasura-user-id': String(user.id),
        ...(contractorProfileId ? { 'x-hasura-contractor-id': String(contractorProfileId) } : {}),
      },
    }

    return this.jwtService.signAsync(payload)
  }
}

/**
 * A real bcrypt hash of a value nobody knows, used only to burn the same time a genuine comparison
 * would. It has to be a VALID hash — bcrypt throws on a malformed one, which would turn the
 * "no such user" path into a 500 that anyone can trigger by guessing an unregistered address.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.rNAWK/vNWaVnpUjnaZ5CmNBZ2H8Uu8W'
