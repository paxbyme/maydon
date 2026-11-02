import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Locale } from '@prisma/client';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class SportTranslationDto {
  @ApiProperty({ enum: Locale }) @IsEnum(Locale) locale!: Locale;
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;
}
export class SportContentDto {
  @ApiProperty() @IsBoolean() active!: boolean;
  @ApiProperty({ type: [SportTranslationDto], minItems: 3, maxItems: 3 })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ArrayUnique((item: SportTranslationDto) => item?.locale)
  @ValidateNested({ each: true })
  @Type(() => SportTranslationDto)
  translations!: SportTranslationDto[];
}
export class SportCreateDto extends SportContentDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 80,
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  })
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
export class SportUpdateDto extends SportContentDto {
  @ApiProperty({ type: 'integer', minimum: 1 })
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}
export class SportResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ type: 'integer' }) revision!: number;
  @ApiProperty({ type: [SportTranslationDto] })
  translations!: SportTranslationDto[];
}
export class SportPageResponse {
  @ApiProperty({ type: [SportResponse] }) items!: SportResponse[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
