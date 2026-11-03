import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Locale } from '@prisma/client';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class FacilityTranslationDto {
  @ApiProperty({ enum: Locale }) @IsEnum(Locale) locale!: Locale;
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  name!: string;
  @ApiProperty({ minLength: 10, maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @Length(10, 5000)
  description!: string;
}
export class FacilityCreateDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Transform(trim)
  @IsString()
  @Length(5, 500)
  address!: string;
  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude!: number;
  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude!: number;
  @ApiProperty({
    type: [FacilityTranslationDto],
    minItems: 1,
    maxItems: 3,
    description:
      'One to three translations; at most one per locale (uz, ru, en)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique((item: FacilityTranslationDto) => item?.locale)
  @ValidateNested({ each: true })
  @Type(() => FacilityTranslationDto)
  translations!: FacilityTranslationDto[];
}
export class FacilityUpdateDto extends FacilityCreateDto {
  @ApiProperty({ type: 'integer', minimum: 1 })
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}
export class FacilityResponse {
  @ApiProperty() id!: string;
  @ApiProperty() ownerId!: string;
  @ApiProperty() city!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ type: Number, nullable: true }) latitude!: number | null;
  @ApiProperty({ type: Number, nullable: true }) longitude!: number | null;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true }) reviewReason!: string | null;
  @ApiProperty({ type: 'integer' }) revision!: number;
  @ApiProperty({ type: [FacilityTranslationDto] })
  translations!: FacilityTranslationDto[];
}
export class FacilityPageResponse {
  @ApiProperty() canEdit!: boolean;
  @ApiProperty({ type: [FacilityResponse] }) items!: FacilityResponse[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
