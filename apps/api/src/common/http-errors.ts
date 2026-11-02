import { AuthError } from '../identity/auth.errors';
import { RateLimitException } from '../identity/rate-limit.service';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Server-generated IDs prevent client-controlled text from entering diagnostic identifiers.
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const requestId = randomUUID();
  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  if (
    ['/api/v1/auth', '/api/v1/businesses', '/api/v1/admin'].some((prefix) =>
      request.path.startsWith(prefix),
    )
  )
    response.setHeader('Cache-Control', 'no-store');
  next();
}

const codes: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'The request could not be completed.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      code =
        error instanceof AuthError
          ? error.code
          : (codes[status] ?? 'REQUEST_FAILED');
      if (error instanceof RateLimitException)
        response.setHeader('Retry-After', error.retryAfter);
      // Do not echo arbitrary exception messages, request bodies or URLs.
      message =
        status === 400
          ? 'The request contains invalid fields.'
          : status === 404
            ? 'The requested resource was not found.'
            : status === 409
              ? 'The request conflicts with current state.'
              : 'The request was rejected.';
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P2002', 'P2003', 'P2004', 'P2034'].includes(error.code)) {
        status = 409;
        code = 'CONFLICT';
        message = 'The request conflicts with current state.';
      }
    }
    response.status(status).json({
      code,
      message,
      requestId: response.locals.requestId ?? randomUUID(),
    });
  }
}
