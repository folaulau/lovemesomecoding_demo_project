import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator'

import { PROJECT_STATUSES, ProjectStatus } from '../../common/enums.js'
import type { ProjectStatus as ProjectStatusType } from '../../common/enums.js'

export class CreateProjectDto {
  /** ⚠️ The category's PUBLIC id. `@IsUUID` also rejects `"1"`, which is what a client that
   *  learned the internal ids would send. */
  @IsUUID('4', { message: 'Pick a service category.' })
  categoryId: string

  @IsString()
  @Length(5, 160, { message: 'Give the project a title of 5 to 160 characters.' })
  title: string

  @IsString()
  @Length(20, 5000, { message: 'Describe the job in at least 20 characters.' })
  description: string

  @IsString()
  @Length(1, 100)
  city: string

  @IsString()
  @Length(2, 2, { message: 'Use the two-letter state code.' })
  state: string

  @IsString()
  @Length(3, 10)
  zip: string

  /**
   * ⚠️ `@Type(() => Number)` is doing real work, not decoration.
   *
   * A JSON body already carries numbers, but a form-encoded or query-string request carries the
   * string `"1800"`, and `@IsNumber()` would reject it. `@Type` runs class-transformer's
   * conversion BEFORE validation. It only takes effect because `main.ts` sets
   * `transform: true` on the global ValidationPipe.
   */
  @Type(() => Number)
  @IsNumber({}, { message: 'Enter a budget in whole dollars.' })
  @Min(0)
  budgetMin: number

  @Type(() => Number)
  @IsNumber({}, { message: 'Enter a budget in whole dollars.' })
  @Min(0)
  budgetMax: number

  /**
   * ⚠️ Validated as a date STRING and stored as one. Declaring this `Date` would have
   * class-transformer parse `"2026-09-10"` as UTC midnight and then Postgres would store whatever
   * local day that lands on — the exact bug the `date` column type exists to avoid.
   */
  @IsISO8601({ strict: true }, { message: 'Pick a start date.' })
  preferredStartDate: string
}

export class UpdateProjectStatusDto {
  /**
   * The target state. The rule about which transitions are legal, and who may make each one, is
   * not expressible here — it depends on the CURRENT status and on the caller. It lives in
   * `ProjectsService.updateStatus`, and this only checks the value is a status at all.
   */
  @IsIn(PROJECT_STATUSES)
  status: ProjectStatusType
}

export class AcceptQuoteDto {
  @IsUUID('4')
  quoteId: string
}

/** Exported so the service can name the terminal states without re-listing them. */
export const CANCELLABLE_BY_HOMEOWNER: ProjectStatusType[] = [
  ProjectStatus.OPEN,
  ProjectStatus.QUOTED,
]
