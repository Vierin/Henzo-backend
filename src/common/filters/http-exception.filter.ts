import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Extract error message
    const errorMessage =
      typeof message === 'string'
        ? message
        : (message as any)?.message || 'Internal server error';

    // Log error details
    const errorDetails = {
      statusCode: status,
      message: errorMessage,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      ...(exception instanceof Error && { 
        stack: exception.stack,
        name: exception.name,
        message: exception.message,
      }),
    };

    if (status >= 500) {
      this.logger.error('Internal server error', JSON.stringify(errorDetails, null, 2));
      // Log full exception for debugging
      if (exception instanceof Error) {
        this.logger.error('Exception stack:', exception.stack);
      }
      
      // Send to Sentry for server errors
      if (process.env.SENTRY_DSN && exception instanceof Error) {
        Sentry.captureException(exception, {
          tags: {
            path: request.url,
            method: request.method,
          },
          extra: errorDetails,
        });
      }
    } else {
      // Не логируем как WARN неподдерживаемые WebDAV методы - они не критичны
      const unsupportedMethods = ['PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'];
      if (unsupportedMethods.includes(request.method)) {
        // Игнорируем логирование для WebDAV методов - это обычно сканеры безопасности
        return response.status(status).json({
          code: status,
          error_code: 'method_not_allowed',
          msg: errorMessage,
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
      this.logger.warn('Client error', errorDetails);
    }

    // Return formatted error response
    const errorResponse: any = {
      code: status,
      error_code: status >= 500 ? 'unexpected_failure' : 'client_error',
      msg: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      errorResponse.stack = exception.stack;
      errorResponse.details = errorDetails;
    }

    response.status(status).json(errorResponse);
  }
}
