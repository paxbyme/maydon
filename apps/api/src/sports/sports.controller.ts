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
import { AuthenticatedRequest, Public } from '../identity/auth.guard';
import { BusinessPageQuery } from '../businesses/businesses.dto';
import {
  SportCreateDto,
  SportPageResponse,
  SportResponse,
  SportUpdateDto,
} from './sports.dto';
import { SportsService } from './sports.service';
@ApiTags('sports')
@Controller('sports')
export class SportsController {
  constructor(private readonly service: SportsService) {}
  @Get()
  @Public()
  @ApiOkResponse({ type: SportPageResponse })
  @ApiOperation({
    summary:
      'Guest access; active sports with complete uz/ru/en names, cursor page of at most 25',
  })
  list(@Query() query: BusinessPageQuery) {
    return this.service.list(query.cursor);
  }
}
@ApiTags('sports')
@ApiBearerAuth()
@Controller('admin/sports')
export class SportsAdminController {
  constructor(private readonly service: SportsService) {}
  @Get()
  @ApiOkResponse({ type: SportPageResponse })
  @ApiOperation({
    summary:
      'MFA-verified administrator with verified email; includes inactive sports, bounded pagination',
  })
  list(
    @Query() query: BusinessPageQuery,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.list(query.cursor, request.principal);
  }
  @Post()
  @ApiCreatedResponse({ type: SportResponse })
  @ApiOperation({
    summary:
      'MFA-verified administrator; create sport with immutable unique slug and all three translations, audited',
  })
  create(
    @Body() body: SportCreateDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.create(
      request.principal,
      body,
      response.locals.requestId,
    );
  }
  @Put(':id')
  @ApiOkResponse({ type: SportResponse })
  @ApiOperation({
    summary:
      'MFA-verified administrator; rename or activate/deactivate with expectedRevision, retains historical references',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SportUpdateDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.update(
      request.principal,
      id,
      body,
      response.locals.requestId,
    );
  }
}
