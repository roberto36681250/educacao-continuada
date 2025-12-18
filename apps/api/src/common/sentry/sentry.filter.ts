import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';

@Injectable()
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Only report 5xx errors to Sentry
    if (status >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag('requestId', (request as any).id);
        scope.setTag('route', `${request.method} ${request.path}`);
        scope.setTag('statusCode', status.toString());

        if ((request as any).user) {
          scope.setUser({
            id: (request as any).user.id,
            email: (request as any).user.email,
          });
        }

        scope.setContext('request', {
          method: request.method,
          url: request.url,
          query: request.query,
          params: request.params,
          // Don't include body to avoid logging sensitive data
        });

        Sentry.captureException(exception);
      });
    }

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error', statusCode: status };

    response.status(status).json(
      typeof message === 'string'
        ? { message, statusCode: status }
        : message,
    );
  }
}
