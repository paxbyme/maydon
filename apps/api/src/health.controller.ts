import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';

export class HealthResponse {
  @ApiProperty({ type: String, enum: ['ok'] })
  status: 'ok' = 'ok';
}
export class VersionResponse {
  @ApiProperty({ type: String, example: 'maydon-api' })
  service = 'maydon-api';
  @ApiProperty({ type: String, example: '0.1.0' })
  version = '0.1.0';
  @ApiProperty({ type: String, example: 'v1' })
  apiVersion = 'v1';
}

@ApiTags('system')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({
    operationId: 'getHealth',
    summary: 'Public process liveness; does not check dependencies',
  })
  @ApiOkResponse({ type: HealthResponse })
  health(): HealthResponse {
    return new HealthResponse();
  }

  @Get('version')
  @ApiOperation({
    operationId: 'getVersion',
    summary: 'Public service version',
  })
  @ApiOkResponse({ type: VersionResponse })
  version(): VersionResponse {
    return new VersionResponse();
  }
}
