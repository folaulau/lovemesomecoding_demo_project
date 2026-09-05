import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'

export class CreateReviewDto {
  @IsUUID('4')
  projectId: string

  /** 1–5 here, and a CHECK constraint on the table saying the same thing. The DTO protects the
   *  API; the constraint protects the table, which the seed script also writes to. */
  @Type(() => Number)
  @IsInt({ message: 'Pick a rating from 1 to 5 stars.' })
  @Min(1)
  @Max(5)
  rating: number

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string
}
