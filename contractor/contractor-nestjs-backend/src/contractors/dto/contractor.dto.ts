import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class UpdateContractorProfileDto {
  @IsString()
  @Length(2, 160, { message: 'Your business needs a name.' })
  businessName: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  yearsInBusiness: number

  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenseNumber?: string

  @IsString()
  @Length(1, 100)
  city: string

  @IsString()
  @Length(2, 2, { message: 'Use the two-letter state code.' })
  state: string

  @IsString()
  @Length(3, 10)
  zip: string

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  serviceRadiusMiles: number

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourlyRateMin: number

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourlyRateMax: number

  /**
   * ⚠️ `each: true` applies the rule to every ELEMENT, not to the array. Without it `@IsUUID`
   * checks whether the array itself is a UUID, which it never is — so the field is effectively
   * unvalidated while looking validated.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Pick at least one service so homeowners can find you.' })
  @IsUUID('4', { each: true })
  categoryIds: string[]

  /**
   * ⚠️ There is no `ratingAverage` or `reviewCount` here, and there never will be. Both are
   * derived by the backend from the review rows. A DTO field for either would be a contractor
   * setting their own rating — which is the first thing anyone would try on a marketplace.
   */
}

export class AddPortfolioImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string
}
