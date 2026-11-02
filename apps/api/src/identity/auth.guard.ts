import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService, Principal } from './auth.service';
import { AuthError } from './auth.errors';

const publicKey = 'maydon:public';
const pendingKey = 'maydon:mfa-pending';
export const Public = () => SetMetadata(publicKey, true);
export const AllowMfaPending = () => SetMetadata(pendingKey, true);
export interface AuthenticatedRequest extends Request {
  principal: Principal;
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride(publicKey, targets)) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.length > 4096)
      throw new UnauthorizedException();
    request.principal = await this.auth.authenticate(authorization.slice(7));
    if (
      (request.principal.roles.includes('ADMIN') ||
        !!request.principal.user.mfaEnabledAt) &&
      !request.principal.session.mfaVerifiedAt &&
      !this.reflector.getAllAndOverride(pendingKey, targets)
    )
      throw new AuthError('MFA_REQUIRED');
    return true;
  }
}
