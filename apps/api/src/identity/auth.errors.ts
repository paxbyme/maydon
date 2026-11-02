import { HttpException } from '@nestjs/common';

export type AuthErrorCode =
  | 'INVALID_CHALLENGE'
  | 'MFA_REQUIRED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'PHONE_VERIFICATION_REQUIRED'
  | 'RESOURCE_SCOPE_DENIED'
  | 'MFA_ALREADY_ENABLED'
  | 'MFA_NOT_CONFIGURED';
export class AuthError extends HttpException {
  constructor(
    readonly code: AuthErrorCode,
    status = 403,
  ) {
    super('Request rejected', status);
  }
}
