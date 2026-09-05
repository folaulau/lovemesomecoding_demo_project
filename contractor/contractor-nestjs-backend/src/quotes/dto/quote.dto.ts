import { Type } from 'class-transformer'
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'

export class CreateQuoteDto {
  @IsUUID('4')
  projectId: string

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Enter the amount you would charge.' })
  @Min(1, { message: 'A quote has to be more than nothing.' })
  amount: number

  /**
   * ⚠️ A ceiling as well as a floor. Without one, a typo of `365` days is stored happily and shows
   * the homeowner a quote of "a year of work" with nothing flagging it. 365 is generous enough to
   * never block a real job and tight enough to catch a slipped keystroke.
   */
  @Type(() => Number)
  @IsInt({ message: 'Estimate the job in whole days.' })
  @Min(1)
  @Max(365)
  estimatedDays: number

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string
}
