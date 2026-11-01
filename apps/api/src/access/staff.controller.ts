import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { StaffPreset } from '@prisma/client';
import { IsEnum } from 'class-validator';
import type { Response } from 'express';
import { AuthenticatedRequest } from '../identity/auth.guard';
import { ResourceAccessService } from './resource-access.service';
class AssignmentDto {
  @ApiProperty({ enum: StaffPreset }) @IsEnum(StaffPreset) preset!: StaffPreset;
}
@ApiTags('staff')
@ApiBearerAuth()
@Controller('resources/:resourceId/staff')
export class StaffController {
  constructor(private readonly access: ResourceAccessService) {}
  @Put(':userId')
  @ApiOperation({
    summary:
      'Owning business members only; assigns one explicit resource to a verified account',
  })
  assign(
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AssignmentDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.access.assign(
      request.principal.user.id,
      resourceId,
      userId,
      body.preset,
      response.locals.requestId,
    );
  }
  @Delete(':userId')
  @ApiOperation({
    summary:
      'Owning business members only; revoke this resource assignment, audited and idempotent',
  })
  revoke(
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.access.revoke(
      request.principal.user.id,
      resourceId,
      userId,
      response.locals.requestId,
    );
  }
}
