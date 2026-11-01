import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EmailDto {
  @ApiProperty({ type: String }) @IsEmail() @MaxLength(254) email!: string;
}
export class RegisterDto extends EmailDto {
  @ApiProperty({ type: String, minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
  @ApiProperty({ type: String })
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  displayName!: string;
  @ApiPropertyOptional({ enum: ['uz', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  locale?: Locale;
}
export class LoginDto extends EmailDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
  @ApiProperty({ enum: ['web', 'mobile'], default: 'web' })
  @IsIn(['web', 'mobile'])
  client: 'web' | 'mobile' = 'web';
}
export class RefreshDto {
  @ApiProperty({ enum: ['web', 'mobile'], default: 'web' })
  @IsIn(['web', 'mobile'])
  client: 'web' | 'mobile' = 'web';
  @ApiPropertyOptional({
    type: String,
    description: 'Mobile clients only; web uses a Secure HttpOnly cookie.',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  refreshToken?: string;
}
export class ChallengeDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() challengeId!: string;
  @ApiProperty({ type: String }) @Matches(/^\d{6}$/) code!: string;
}
export class ResetPasswordDto extends ChallengeDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
export class PhoneDto {
  @ApiProperty({ type: String, example: '+998901234567' })
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;
}
export class ProfileDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  displayName?: string;
  @ApiPropertyOptional({ enum: ['uz', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  locale?: Locale;
}
export class MfaSetupDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
export class MfaCodeDto {
  @ApiProperty({ type: String }) @Matches(/^\d{6}$/) code!: string;
}
