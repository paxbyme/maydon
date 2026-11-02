import {
  AcceptedResponse,
  VerifiedResponse,
  RevokedResponse,
  ProfileResponse,
  TokensResponse,
  MfaSetupResponse,
} from './auth.responses';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiAcceptedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthContext, AuthService } from './auth.service';
import { AllowMfaPending, AuthenticatedRequest, Public } from './auth.guard';
import {
  ChallengeDto,
  EmailDto,
  LoginDto,
  MfaCodeDto,
  MfaSetupDto,
  PhoneDto,
  ProfileDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from './auth.dto';

export const REFRESH_COOKIE = '__Host-maydon-refresh';
export const CSRF_COOKIE = '__Host-maydon-csrf';
function context(
  request: AuthenticatedRequest,
  response: Response,
  web = false,
): AuthContext {
  return {
    ip: request.ip ?? request.socket.remoteAddress ?? 'unknown',
    requestId: response.locals.requestId,
    origin: request.get('Origin'),
    csrf: request.get('X-CSRF-Token'),
    web,
  };
}
function refreshCookie(request: AuthenticatedRequest) {
  const values = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${REFRESH_COOKIE}=`));
  if (values.length !== 1) throw new UnauthorizedException();
  return values[0]!.slice(REFRESH_COOKIE.length + 1);
}
function sendTokens(
  response: Response,
  result: Awaited<ReturnType<AuthService['login']>>,
  web: boolean,
) {
  const { refreshToken, csrf, expiresAt, ...visible } = result;
  if (web) {
    const options = {
      secure: true,
      sameSite: 'strict' as const,
      path: '/',
      expires: expiresAt,
    };
    response.cookie(REFRESH_COOKIE, refreshToken, {
      ...options,
      httpOnly: true,
    });
    if (csrf)
      response.cookie(CSRF_COOKIE, csrf, { ...options, httpOnly: false });
    return { ...visible, refreshExpiresAt: expiresAt.toISOString() };
  }
  return {
    ...visible,
    refreshToken,
    refreshExpiresAt: expiresAt.toISOString(),
  };
}

@ApiTags('identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @ApiAcceptedResponse({ type: AcceptedResponse })
  @Post('register')
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Public registration; generic response prevents account enumeration',
  })
  register(
    @Body() body: RegisterDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.register(body, context(request, response));
  }
  @Public()
  @ApiAcceptedResponse({ type: AcceptedResponse })
  @Post('email/resend')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Public email verification resend; rate limited, generic response',
  })
  resend(
    @Body() body: EmailDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.requestEmail(
      body.email,
      'VERIFY_EMAIL',
      context(request, response),
    );
  }
  @Public()
  @ApiOkResponse({ type: VerifiedResponse })
  @Post('email/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Public single-use email challenge verification' })
  verifyEmail(
    @Body() body: ChallengeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.verifyEmail(
      body.challengeId,
      body.code,
      context(request, response),
    );
  }
  @Public()
  @ApiAcceptedResponse({ type: AcceptedResponse })
  @Post('password/forgot')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Public password recovery request; generic response',
  })
  forgot(
    @Body() body: EmailDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.requestEmail(
      body.email,
      'RESET_PASSWORD',
      context(request, response),
    );
  }
  @Public()
  @ApiOkResponse({ type: VerifiedResponse })
  @Post('password/reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Public single-use recovery; revokes every existing session',
  })
  reset(
    @Body() body: ResetPasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.resetPassword(
      body.challengeId,
      body.code,
      body.password,
      context(request, response),
    );
  }
  @Public()
  @ApiOkResponse({ type: TokensResponse })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Public login; web requires allowlisted Origin, mobile rejects browser Origin',
  })
  async login(
    @Body() body: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const web = body.client === 'web';
    return sendTokens(
      response,
      await this.auth.login(
        body.email,
        body.password,
        context(request, response, web),
      ),
      web,
    );
  }
  @Public()
  @ApiOkResponse({ type: TokensResponse })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Rotate refresh credential; web requires cookie, Origin and X-CSRF-Token',
  })
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const web = body.client === 'web';
    if (web && body.refreshToken) throw new BadRequestException();
    const token = web ? refreshCookie(request) : body.refreshToken;
    if (!token) throw new UnauthorizedException();
    return sendTokens(
      response,
      await this.auth.refresh(token, context(request, response, web)),
      web,
    );
  }
  @AllowMfaPending()
  @ApiBearerAuth()
  @ApiOkResponse({ type: ProfileResponse })
  @Get('me')
  @ApiOperation({
    summary: 'Own profile only; pending administrator MFA is allowed for setup',
  })
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.profile(request.principal);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ type: ProfileResponse })
  @Patch('me')
  @ApiOperation({
    summary: 'Update own display name/locale; administrators must complete MFA',
  })
  profile(@Body() body: ProfileDto, @Req() request: AuthenticatedRequest) {
    return this.auth.updateProfile(request.principal, body);
  }

  @ApiBearerAuth()
  @ApiAcceptedResponse({ type: AcceptedResponse })
  @Post('phone/request')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Own account; verified email required before requesting SMS',
  })
  phone(
    @Body() body: PhoneDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.requestPhone(
      request.principal,
      body.phone,
      context(request, response),
    );
  }
  @ApiBearerAuth()
  @ApiOkResponse({ type: VerifiedResponse })
  @Post('phone/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Own authenticated account and own phone challenge only',
  })
  verifyPhone(
    @Body() body: ChallengeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.verifyPhone(
      request.principal,
      body.challengeId,
      body.code,
      context(request, response),
    );
  }
  @AllowMfaPending()
  @ApiBearerAuth()
  @ApiOkResponse({ type: RevokedResponse })
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Revoke current session; web requires Origin and CSRF protection',
  })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.logout(
      request.principal,
      context(request, response, request.principal.session.web),
    );
    for (const name of [REFRESH_COOKIE, CSRF_COOKIE])
      response.clearCookie(name, {
        secure: true,
        sameSite: 'strict',
        path: '/',
      });
    return result;
  }
  @ApiBearerAuth()
  @ApiOkResponse({ type: RevokedResponse })
  @Post('sessions/revoke')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Revoke all own sessions; administrator MFA and web CSRF required',
  })
  async revoke(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.logout(
      request.principal,
      context(request, response, request.principal.session.web),
      true,
    );
    for (const name of [REFRESH_COOKIE, CSRF_COOKIE]) {
      response.clearCookie(name, {
        secure: true,
        sameSite: 'strict',
        path: '/',
      });
    }
    return result;
  }
  @AllowMfaPending()
  @ApiBearerAuth()
  @ApiOkResponse({ type: MfaSetupResponse })
  @Post('mfa/setup')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Own verified-email account with password proof; returns enrollment secret once per setup',
  })
  setup(
    @Body() body: MfaSetupDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.setupMfa(
      request.principal,
      body.password,
      context(request, response),
    );
  }
  @AllowMfaPending()
  @ApiBearerAuth()
  @ApiOkResponse({ type: VerifiedResponse })
  @Post('mfa/confirm')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm own pending TOTP enrollment and elevate current session',
  })
  confirm(
    @Body() body: MfaCodeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.verifyMfa(
      request.principal,
      body.code,
      context(request, response),
      true,
    );
  }
  @AllowMfaPending()
  @ApiBearerAuth()
  @ApiOkResponse({ type: VerifiedResponse })
  @Post('mfa/verify')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Verify existing TOTP to elevate current session; replay protected',
  })
  verify(
    @Body() body: MfaCodeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.verifyMfa(
      request.principal,
      body.code,
      context(request, response),
      false,
    );
  }
}
