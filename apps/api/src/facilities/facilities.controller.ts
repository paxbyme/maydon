import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticatedRequest } from '../identity/auth.guard';
import { BusinessPageQuery } from '../businesses/businesses.dto';
import {
  FacilityCreateDto,
  FacilityPageResponse,
  FacilityResponse,
  FacilityUpdateDto,
} from './facilities.dto';
import { FacilitiesService } from './facilities.service';
@ApiTags('facilities')
@ApiBearerAuth()
@Controller('businesses/:ownerId/facilities')
export class FacilitiesController {
  constructor(private readonly service: FacilitiesService) {}
  @Get()
  @ApiOkResponse({ type: FacilityPageResponse })
  @ApiOperation({
    summary:
      'Owning business members only; private facility list, cursor page of 25',
  })
  list(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Query() query: BusinessPageQuery,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.list(request.principal, ownerId, query.cursor);
  }
  @Post()
  @ApiCreatedResponse({ type: FacilityResponse })
  @ApiOperation({
    summary:
      'Verified member of approved business only; create unpublished Namangan facility draft with localized content',
  })
  create(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() body: FacilityCreateDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.create(
      request.principal,
      ownerId,
      body,
      response.locals.requestId,
    );
  }
  @Put(':id')
  @ApiOkResponse({ type: FacilityResponse })
  @ApiOperation({
    summary:
      'Verified member of approved owning business only; edit draft/rejected facility using expectedRevision; stale or published edits return 409',
  })
  update(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FacilityUpdateDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.update(
      request.principal,
      ownerId,
      id,
      body,
      response.locals.requestId,
    );
  }
}
