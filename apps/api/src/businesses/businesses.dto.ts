import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class BusinessSubmissionDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  legalName!: string;
  @ApiProperty({
    minLength: 30,
    maxLength: 5000,
    description:
      'Private explanation of business ownership and how reviewers can verify it. No passwords or payment data.',
  })
  @Transform(trim)
  @IsString()
  @Length(30, 5000)
  evidence!: string;
}
export class BusinessReviewDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @Length(5, 1000)
  reason!: string;
}
export class BusinessPageQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
export class BusinessResponse {
  @ApiProperty() id!: string;
  @ApiProperty() legalName!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true }) reviewReason!: string | null;
  @ApiProperty() createdAt!: string;
}
export class BusinessPageResponse {
  @ApiProperty({ type: [BusinessResponse] }) items!: BusinessResponse[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class BusinessEvidenceResponse {
  @ApiProperty() evidence!: string;
}
