import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class AcceptedResponse {
  @ApiProperty({ type: Boolean, enum: [true] }) accepted!: true;
}
export class VerifiedResponse {
  @ApiProperty({ type: Boolean, enum: [true] }) verified!: true;
}
export class RevokedResponse {
  @ApiProperty({ type: Boolean, enum: [true] }) revoked!: true;
}
export class ProfileResponse {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'email' }) email!: string;
  @ApiProperty({ type: String }) displayName!: string;
  @ApiProperty({ type: String, enum: ['uz', 'ru', 'en'] }) locale!: string;
  @ApiProperty({ type: Boolean }) emailVerified!: boolean;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: Boolean }) phoneVerified!: boolean;
  @ApiProperty({ type: Boolean }) mfaEnabled!: boolean;
}
export class TokensResponse {
  @ApiProperty({ type: String }) accessToken!: string;
  @ApiProperty({ type: Number, example: 900 }) expiresIn!: number;
  @ApiProperty({ type: String, format: 'date-time' }) refreshExpiresAt!: string;
  @ApiPropertyOptional({
    type: String,
    description:
      'Mobile clients only. Web refresh credentials are HttpOnly cookies.',
  })
  refreshToken?: string;
  @ApiProperty({ type: Boolean }) mfaRequired!: boolean;
  @ApiProperty({ type: ProfileResponse }) user!: ProfileResponse;
}
export class MfaSetupResponse {
  @ApiProperty({
    type: String,
    description: 'Enrollment secret; never log or persist in browser storage.',
  })
  secret!: string;
  @ApiProperty({ type: String }) uri!: string;
}
