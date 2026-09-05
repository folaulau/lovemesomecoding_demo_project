import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource, In } from 'typeorm'

import type { AuthenticatedUser } from '../auth/jwt-payload.js'
import { toContractorDto, toPortfolioImageDto } from '../common/serializers.js'
import type { AppConfig } from '../config/configuration.js'
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import { PortfolioImage } from '../database/entities/portfolio-image.entity.js'
import { ServiceCategory } from '../database/entities/service-category.entity.js'
import type { UpdateContractorProfileDto } from './dto/contractor.dto.js'
import { sniffImageType } from './image-validation.js'

/** Everything the serialiser needs. Named once so no method can load half of it. */
const PROFILE_RELATIONS = { user: true, categories: true, portfolio: true } as const

@Injectable()
export class ContractorsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  async updateProfile(user: AuthenticatedUser, dto: UpdateContractorProfileDto) {
    if (dto.hourlyRateMax < dto.hourlyRateMin) {
      throw new BadRequestException('The top of your rate cannot be below the bottom of it.')
    }

    const profile = await this.loadOwnProfile(user)

    // The categories are looked up by PUBLIC id and then compared — a client that sends four ids
    // and gets three categories has sent one that does not exist, and silently saving the three is
    // how a pro ends up wondering why they see no leads for a trade they thought they had picked.
    const categories = await this.dataSource
      .getRepository(ServiceCategory)
      .find({ where: { publicId: In(dto.categoryIds) } })

    if (categories.length !== dto.categoryIds.length) {
      throw new BadRequestException('One of those services does not exist.')
    }

    Object.assign(profile, {
      businessName: dto.businessName.trim(),
      bio: dto.bio?.trim() ?? '',
      yearsInBusiness: dto.yearsInBusiness,
      licenseNumber: dto.licenseNumber?.trim() || null,
      city: dto.city.trim(),
      state: dto.state.trim().toUpperCase(),
      zip: dto.zip.trim(),
      serviceRadiusMiles: dto.serviceRadiusMiles,
      hourlyRateMin: dto.hourlyRateMin,
      hourlyRateMax: dto.hourlyRateMax,
      categories,
      // ⚠️ `ratingAverage` and `reviewCount` are deliberately absent. `Object.assign` copies
      // whatever it is given, so listing the fields explicitly — rather than spreading the DTO —
      // is what stops a field added to the DTO later from silently becoming writable.
    })

    // `save` on an entity with a loaded many-to-many rewrites the join table to match the array,
    // so removing a trade works without a separate delete.
    const saved = await this.dataSource.getRepository(ContractorProfile).save(profile)
    return toContractorDto(
      await this.dataSource.getRepository(ContractorProfile).findOneOrFail({
        where: { id: saved.id },
        relations: PROFILE_RELATIONS,
      }),
    )
  }

  /**
   * Stores one portfolio photo.
   *
   * Three defences, and all three are needed:
   *   1. the size cap, checked against the buffer that actually arrived;
   *   2. the BYTES must be a JPEG, PNG or WebP — `file.mimetype` is client-supplied and is not
   *      consulted for the decision;
   *   3. the stored filename is generated from a UUID, so `../../etc/passwd` as an original
   *      filename has nowhere to go.
   */
  async addPortfolioImage(
    user: AuthenticatedUser,
    file: { buffer: Buffer; size: number; mimetype: string; originalname: string } | undefined,
    caption: string | undefined,
  ) {
    if (!file) throw new BadRequestException('Choose an image to upload.')

    const uploads = this.config.getOrThrow<AppConfig['uploads']>('uploads')

    /**
     * ⚠️ Checked against `buffer.length`, not against the `Content-Length` header. The header is
     * client-supplied like everything else; the buffer is what is about to be written to disk.
     *
     * Multer's own `limits.fileSize` also caps this (see the controller) and that one matters
     * more, because it stops reading rather than reading it all and then complaining. This is the
     * belt to that braces.
     */
    if (file.buffer.length > uploads.maxBytes) {
      const mb = Math.round(uploads.maxBytes / (1024 * 1024))
      throw new PayloadTooLargeException(`Images must be ${mb} MB or smaller.`)
    }

    const sniffed = sniffImageType(file.buffer)
    if (!sniffed) {
      throw new UnsupportedMediaTypeException('Upload a JPEG, PNG or WebP image.')
    }

    const profile = await this.loadOwnProfile(user)

    // ⚠️ The filename is generated, and `resolve` on a directory that never includes user input
    // means there is no path to traverse. Using `file.originalname` here — even "sanitised" — is
    // how uploads directories end up with files nobody intended.
    const filename = `${randomUUID()}.${sniffed.extension}`
    const directory = resolve(process.cwd(), uploads.directory)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, filename), file.buffer)

    // ⚠️ A RELATIVE path in the database. Storing `http://localhost:3001/uploads/…` bakes today's
    // host into every row, and the day this moves behind a domain every image 404s.
    const url = `/uploads/${filename}`

    const image = this.dataSource.getRepository(PortfolioImage).create({
      contractorId: profile.id,
      url,
      caption: caption?.trim() || null,
      sortOrder: profile.portfolio.length,
    })
    const saved = await this.dataSource.getRepository(PortfolioImage).save(image)
    return toPortfolioImageDto(saved)
  }

  async removePortfolioImage(user: AuthenticatedUser, imagePublicId: string) {
    const profile = await this.loadOwnProfile(user)

    const image = await this.dataSource.getRepository(PortfolioImage).findOne({
      // Scoped to THIS profile, so a pro cannot delete another pro's photos by guessing an id.
      // Filtering by id alone and checking ownership afterwards works too — but only if you
      // remember to, every time.
      where: { publicId: imagePublicId, contractorId: profile.id },
    })
    if (!image) throw new NotFoundException('That image no longer exists.')

    await this.dataSource.getRepository(PortfolioImage).remove(image)

    /**
     * The row goes first, the file second — and if the unlink fails, the request still succeeds.
     *
     * The other order leaves a row pointing at a file that is gone, which renders as a broken
     * image forever. This order leaves an unreferenced file on disk, which costs a few kilobytes
     * and is invisible. When a cleanup has two failure modes, pick the one nobody has to look at.
     */
    const uploads = this.config.getOrThrow<AppConfig['uploads']>('uploads')
    const filename = image.url.split('/').pop()
    if (filename) {
      await unlink(join(resolve(process.cwd(), uploads.directory), filename)).catch(() => {
        // Already gone, or never written. Either way the row is what mattered.
      })
    }
  }

  private async loadOwnProfile(user: AuthenticatedUser): Promise<ContractorProfile> {
    if (!user.contractorId) {
      throw new NotFoundException('This account has no contractor profile.')
    }
    const profile = await this.dataSource.getRepository(ContractorProfile).findOne({
      // ⚠️ The id comes from the TOKEN. Every method here operates on "my profile" and none of
      // them accepts a profile id from the caller — which is what makes "can this pro edit that
      // profile" a question this service never has to ask.
      where: { id: user.contractorId },
      relations: PROFILE_RELATIONS,
    })
    if (!profile) throw new NotFoundException('This account has no contractor profile.')
    return profile
  }
}
