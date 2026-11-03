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
import { BusinessesService } from './businesses.service';
import {
  BusinessEvidenceResponse,
  BusinessPageQuery,
  BusinessPageResponse,
  BusinessResponse,
  BusinessReviewDto,
  BusinessSubmissionDto,
} from './businesses.dto';
@ApiTags('businesses')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}
  @Get()
  @ApiOkResponse({ type: BusinessPageResponse })
  @ApiOperation({
    summary:
      'Own business applications only; cursor page of at most 25, no private evidence',
  })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: BusinessPageQuery,
  ) {
    return this.service.list(request.principal, query.cursor);
  }
  @Post()
  @ApiCreatedResponse({ type: BusinessResponse })
  @ApiOperation({
    summary:
      'Verified email required; submit private ownership evidence for manual review',
  })
  submit(
    @Req() request: AuthenticatedRequest,
    @Body() body: BusinessSubmissionDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.submit(
      request.principal,
      body,
      response.locals.requestId,
    );
  }
  @Put(':id/submission')
  @ApiOkResponse({ type: BusinessResponse })
  @ApiOperation({
    summary:
      'Owning member with verified email; resubmit rejected or draft application only',
  })
  resubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: BusinessSubmissionDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.submit(
      request.principal,
      body,
      response.locals.requestId,
      id,
    );
  }
}
@ApiTags('businesses')
@ApiBearerAuth()
@Controller('admin/businesses')
export class BusinessReviewController {
  constructor(private readonly service: BusinessesService) {}
  @Get()
  @ApiOkResponse({ type: BusinessPageResponse })
  @ApiOperation({
    summary:
      'MFA-verified administrator only; pending review queue, at most 25 per page',
  })
  queue(
    @Req() request: AuthenticatedRequest,
    @Query() query: BusinessPageQuery,
  ) {
    return this.service.list(request.principal, query.cursor, true);
  }
  @Get(':id/evidence')
  @ApiOkResponse({ type: BusinessEvidenceResponse })
  @ApiOperation({
    summary:
      'MFA-verified administrator only; private evidence access is audited',
  })
  evidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.evidence(
      request.principal,
      id,
      response.locals.requestId,
    );
  }
  @Put(':id/review')
  @ApiOkResponse({ type: BusinessResponse })
  @ApiOperation({
    summary:
      'MFA-verified administrator only; cannot review own business; reason required, pending applications only',
  })
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: BusinessReviewDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.review(
      request.principal,
      id,
      body,
      response.locals.requestId,
    );
  }
}
