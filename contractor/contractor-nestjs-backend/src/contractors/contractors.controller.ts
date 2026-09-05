import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'

import type { AuthenticatedUser } from '../auth/jwt-payload.js'
import { CurrentUser } from '../common/decorators/current-user.decorator.js'
import { Roles } from '../common/decorators/roles.decorator.js'
import { UserRole } from '../common/enums.js'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js'
import { RolesGuard } from '../common/guards/roles.guard.js'
import { ContractorsService } from './contractors.service.js'
import { AddPortfolioImageDto, UpdateContractorProfileDto } from './dto/contractor.dto.js'

/** 5 MB, matching `CONTRACTOR_UPLOAD_MAX_BYTES`'s default in configuration.ts. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/**
 * ⚠️ Every route is `me`, never `:contractorId`.
 *
 * The profile being edited is always the one in the caller's token, so there is no id to check
 * ownership of and therefore no ownership check to forget. A `PATCH /contractors/:id` would need
 * that check on every handler, and the one that omits it is the bug.
 */
@Controller('api/v1/contractors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTRACTOR)
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateContractorProfileDto) {
    return this.contractorsService.updateProfile(user, dto)
  }

  @Post('me/portfolio')
  @UseInterceptors(
    FileInterceptor('file', {
      /**
       * ⚠️ `memoryStorage`, not multer's default disk storage — and the difference is a security
       * one, not a performance one. Disk storage writes the file BEFORE any handler runs, so a
       * rejected upload has already landed in a directory. In memory, nothing touches the disk
       * until the bytes have been sniffed and the filename generated.
       *
       * The trade-off is real: the whole file sits in RAM, which is fine at 5 MB per request and
       * would not be for video.
       */
      storage: memoryStorage(),
      /**
       * ⚠️ This limit is the one that matters. Multer stops READING at 5 MB and errors, so a
       * 2 GB upload costs 5 MB of memory rather than 2 GB. The check in the service runs after the
       * bytes are already here, and is a second line rather than the first.
       */
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  addPortfolioImage(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: AddPortfolioImageDto,
  ) {
    return this.contractorsService.addPortfolioImage(user, file, dto.caption)
  }

  /** 204: the image is gone and there is nothing meaningful to return. A 200 with an empty body
   *  would leave a client wondering whether it should have parsed something. */
  @Delete('me/portfolio/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePortfolioImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    await this.contractorsService.removePortfolioImage(user, imageId)
  }
}
